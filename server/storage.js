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

function dirname(objectKey) {
  const parts = String(objectKey).split('/')
  parts.pop()
  return parts.join('/')
}

function basename(objectKey) {
  return String(objectKey).split('/').pop()
}

function notConfigured() {
  return new ApiError(501, 'storage_not_configured', 'An approved object-storage provider has not been configured.')
}

function unconfiguredAdapter() {
  return {
    configured: false,
    createUploadUrl: async () => { throw notConfigured() },
    createDownloadUrl: async () => { throw notConfigured() },
    verifyObject: async () => { throw notConfigured() },
    deleteObject: async () => { throw notConfigured() },
  }
}

function storageError(error, fallback = 'The storage service could not complete that request.') {
  const message = error?.message || fallback
  if (/not found|does not exist|Bucket not found/i.test(message)) {
    return new ApiError(501, 'storage_not_configured', 'Supabase Storage buckets are not ready. See SUPABASE.md.')
  }
  return new ApiError(502, 'storage_unavailable', fallback)
}

/* Provider operations stay server-only. The service_role client issues signed
 * URLs; the browser never talks to Storage with a key that can list private
 * objects. File ownership is still decided by the API before any of these run. */
export function createStorageAdapter({ supabase, publicBaseUrl } = {}) {
  if (!supabase) return unconfiguredAdapter()

  const publicPrefix = String(publicBaseUrl || '').replace(/\/+$/, '')

  return {
    configured: true,
    createUploadUrl: async ({ objectKey, mimeType, visibility, purpose }) => {
      const bucket = bucketFor({ objectKey, visibility, purpose })
      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectKey)
      if (error || !data?.signedUrl) throw storageError(error, 'The storage service could not issue an upload URL.')
      return {
        method: 'PUT',
        url: data.signedUrl,
        headers: {
          ...(mimeType ? { 'content-type': mimeType } : {}),
          ...(data.token ? { authorization: `Bearer ${data.token}` } : {}),
          'x-upsert': 'false',
        },
        bucket,
      }
    },
    createDownloadUrl: async ({ objectKey, visibility, purpose }) => {
      const bucket = bucketFor({ objectKey, visibility, purpose })
      if (bucket === PUBLIC_BUCKET && publicPrefix) {
        return { method: 'GET', url: `${publicPrefix}/${objectKey}`, headers: {} }
      }
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectKey, 60)
      if (error || !data?.signedUrl) throw storageError(error, 'The storage service could not issue a download URL.')
      return { method: 'GET', url: data.signedUrl, headers: {} }
    },
    verifyObject: async ({ objectKey, visibility, purpose }) => {
      const bucket = bucketFor({ objectKey, visibility, purpose })
      const { data, error } = await supabase.storage.from(bucket).list(dirname(objectKey), {
        search: basename(objectKey),
        limit: 10,
      })
      if (error) throw storageError(error, 'The storage service could not verify the upload.')
      const found = (data || []).some((entry) => entry.name === basename(objectKey))
      if (!found) throw new ApiError(404, 'object_not_found', 'The uploaded file was not found in storage.')
    },
    deleteObject: async ({ objectKey, visibility, purpose }) => {
      const bucket = bucketFor({ objectKey, visibility, purpose })
      const { error } = await supabase.storage.from(bucket).remove([objectKey])
      if (error) throw storageError(error, 'The storage service could not delete that file.')
    },
  }
}
