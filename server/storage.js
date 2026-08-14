import { ApiError } from './http.js'
const allowedTypes = new Set(['image/jpeg','image/png','image/webp','application/pdf'])
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export function validateUpload({ mimeType, byteSize, filename }) {
  if (!allowedTypes.has(mimeType)) throw new ApiError(415, 'unsupported_file_type', 'Only JPEG, PNG, WebP, and PDF files are currently accepted.')
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_UPLOAD_BYTES) throw new ApiError(413, 'invalid_file_size', 'The file must be between 1 byte and 25 MB.')
  if (!filename || filename.includes('/') || filename.includes('\\')) throw new ApiError(422, 'invalid_filename', 'The filename is invalid.')
}
export function createObjectKey({ purpose, extension = 'bin' }) { return `${purpose}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'}` }
// Provider operations stay server-only. Implement this adapter when the approved object-storage service is provisioned.
export function createStorageAdapter() { return { createUploadUrl: async () => { throw new ApiError(501, 'storage_not_configured', 'An approved object-storage provider has not been configured.') }, createDownloadUrl: async () => { throw new ApiError(501, 'storage_not_configured', 'An approved object-storage provider has not been configured.') }, verifyObject: async () => { throw new ApiError(501, 'storage_not_configured', 'An approved object-storage provider has not been configured.') }, deleteObject: async () => { throw new ApiError(501, 'storage_not_configured', 'An approved object-storage provider has not been configured.') } } }
