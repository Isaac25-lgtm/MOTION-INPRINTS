import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { fileService } from '../../services/fileService'

const fileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`
const sizeLabel = (bytes) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

export function ArtworkUploader({ orderItemId, quoteRequestId }) {
  const input = useRef(null)
  const [entries, setEntries] = useState([])
  const ownership = orderItemId ? { orderItemId } : { quoteRequestId }

  const update = (key, change) => setEntries(current => current.map(entry => entry.key === key ? { ...entry, ...change } : entry))

  const upload = async (entry) => {
    update(entry.key, { status: 'uploading', progress: 0, error: null })
    try {
      const asset = await fileService.uploadArtwork(entry.file, ownership, { onProgress: progress => update(entry.key, { progress }) })
      update(entry.key, { status: 'complete', progress: 100, assetId: asset.id })
    } catch (error) {
      update(entry.key, { status: 'failed', error: error.message, assetId: error.assetId || null })
    }
  }

  const choose = (event) => {
    const chosen = Array.from(event.target.files || [])
    const additions = chosen.map(file => {
      const error = fileService.validate(file)
      return { key: fileKey(file), file, status: error ? 'failed' : 'queued', progress: 0, error, assetId: null }
    })
    setEntries(current => [...current.filter(old => !additions.some(entry => entry.key === old.key)), ...additions])
    additions.filter(entry => !entry.error).forEach(upload)
    event.target.value = ''
  }

  const remove = async (entry) => {
    if (entry.assetId) {
      update(entry.key, { status: 'removing', error: null })
      try { await fileService.remove(entry.assetId) } catch (error) { update(entry.key, { status: 'failed', error: error.message }); return }
    }
    setEntries(current => current.filter(item => item.key !== entry.key))
  }

  const retry = async (entry) => {
    if (entry.assetId) {
      try { await fileService.remove(entry.assetId) } catch { /* A stale pending intent must not block a fresh signed upload. */ }
    }
    upload({ ...entry, assetId: null })
  }

  return (
    <div className="artwork-uploader stack" aria-label="Artwork files">
      <div>
        <p className="t-h4">Upload artwork</p>
        <p className="t-caption">Private PDF, JPEG, PNG or WebP files, up to 25 MB each.</p>
      </div>
      <input ref={input} hidden type="file" multiple accept={fileService.supportedTypes.join(',')} onChange={choose} />
      <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>Choose files</Button>
      {entries.length > 0 && (
        <ul className="upload-list">
          {entries.map(entry => (
            <li className="upload-list__item" key={entry.key}>
              <div className="stack stack--sm">
                <p className="t-body-sm"><strong>{entry.file.name}</strong> <span className="t-muted">{sizeLabel(entry.file.size)}</span></p>
                {entry.status === 'uploading' && <progress max="100" value={entry.progress} aria-label={`Uploading ${entry.file.name}`}>{entry.progress}%</progress>}
                {entry.status === 'complete' && <p className="t-caption" role="status">Upload complete</p>}
                {entry.error && <p className="field__error" role="alert">{entry.error}</p>}
              </div>
              <div className="cluster">
                {entry.status === 'failed' && !fileService.validate(entry.file) && <Button variant="text" size="sm" onClick={() => retry(entry)}>Retry</Button>}
                <Button variant="text" size="sm" disabled={entry.status === 'uploading' || entry.status === 'removing'} onClick={() => remove(entry)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
