import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button'

/* Drawer / modal. Locks scroll, closes on Escape and scrim click, moves focus in
   and restores it on close, and traps Tab while open. */
export function Drawer({ open, onClose, title, side = 'end', children, footer, labelledBy }) {
  const panel = useRef(null)
  const restoreTo = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    restoreTo.current = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector('button, [href], input, select, textarea')?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div
        className={['drawer', side === 'start' && 'drawer--start'].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        ref={panel}
      >
        <div className="drawer__head">
          <p className="t-eyebrow">{title}</p>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}
