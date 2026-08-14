import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs a service call and exposes { data, loading, error, reload }.
 * Aborts on unmount and on dependency change, so a slow response from a page the
 * visitor has already left can never overwrite the current one.
 *
 * @param {(options: {signal: AbortSignal}) => Promise<unknown>} loader
 * @param {unknown[]} deps
 */
export function useResource(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null })
  const [nonce, setNonce] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    if (!enabled) { setState({ data: null, loading: false, error: null }); return undefined }
    const controller = new AbortController()
    let active = true
    setState(current => ({ ...current, loading: true, error: null }))
    loaderRef.current({ signal: controller.signal })
      .then(data => { if (active) setState({ data, loading: false, error: null }) })
      .catch(error => {
        if (!active || controller.signal.aborted || error.name === 'AbortError') return
        setState({ data: null, loading: false, error })
      })
    return () => { active = false; controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled])

  const reload = useCallback(() => setNonce(value => value + 1), [])
  return { ...state, reload }
}

/** Debounces a fast-changing value, used by the search field. */
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
