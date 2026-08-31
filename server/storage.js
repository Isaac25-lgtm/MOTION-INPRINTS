import { ApiError } from './http.js'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const PRIVATE_BUCKET = 'motion-private'
export const PUBLIC_BUCKET = 'motion-public'
export const ALLOWED_MIME_TYPES = [...allowedTypes]

const PRIVATE_PURPOSES = new Set(['customer_artwork', 'design_proof'])

export function validateUpload({ mimeType, byteSize, filename }) {
  if (!allowedTypes.has(mimeType)) throw new ApiError(415, 'unsupported_file_type', 'Only JPEG, PNG, WebP, and PDF files are currently accepted.')
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_UPLOAD_BYTES) throw new ApiError(413, 'invalid_file_size', 'The file must be between 1 byte and 25 MB.')
  if (!filename || filename.includes('/') || filename.includes('\\')) throw new ApiError(422, 'invalid_filename', 'The filename is invalid.')
}

export function createObjectKey({ purpose, extension = 'bin' }) {
  return `${purpose}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'}`
}

export function bucketFor({ objectKey, visibility, purpose } = {}) {
  if (visibility === 'private') return PRIVATE_BUCKET
  if (visibility === 'public') return PUBLIC_BUCKET
  const fromKey = String(objectKey || '').split('/')[0]
  const kind = purpose || fromKey
  return PRIVATE_PURPOSES.has(kind) ? PRIVATE_BUCKET : PUBLIC_BUCKET
}

function notConfigured() {
  return new ApiError(501, 'storage_not_configured', 'An approved object-storage provider has not been configured.')
}

export function unconfiguredAdapter() {
  return {
    configured: false,
    createUploadUrl: async () => { throw notConfigured() },
    createDownloadUrl: async () => { throw notConfigured() },
    verifyObject: async () => { throw notConfigured() },
    deleteObject: async () => { throw notConfigured() },
  }
}

/* Provider-neutral boundary. This phase always returns the unconfigured adapter.
   A later S3-compatible implementation can be selected here without changing callers. */
export function createStorageAdapter(_options = {}) {
  return unconfiguredAdapter()
}
