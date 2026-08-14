import { request } from './apiClient'

const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const maxBytes = 25 * 1024 * 1024

function transfer(file, upload, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(upload.method || 'PUT', upload.url)
    Object.entries(upload.headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value))
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The storage service rejected the upload.'))
    xhr.onerror = () => reject(new Error('The upload was interrupted.'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'))
    xhr.send(file)
  })
}

export const fileService = {
  supportedTypes,
  maxBytes,
  validate(file) {
    if (!supportedTypes.includes(file.type)) return 'Use JPEG, PNG, WebP or PDF files.'
    if (file.size < 1 || file.size > maxBytes) return 'Each file must be no larger than 25 MB.'
    return null
  },
  async uploadArtwork(file, ownership, { onProgress } = {}) {
    const intent = await request('/files/upload-intent', {
      method: 'POST',
      body: { filename: file.name, mimeType: file.type, byteSize: file.size, purpose: 'customer_artwork', ...ownership },
    })
    try {
      await transfer(file, intent.upload, onProgress)
    } catch (error) {
      error.assetId = intent.asset.id
      throw error
    }
    return request(`/files/${encodeURIComponent(intent.asset.id)}/complete`, { method: 'POST' })
  },
  remove: (assetId) => request(`/files/${encodeURIComponent(assetId)}`, { method: 'DELETE' }),
}
