import { createHash } from 'node:crypto'

/** First 16 hex chars of SHA-256. Shared by the runner and the SQL Editor bootstrap. */
export function checksum(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}
