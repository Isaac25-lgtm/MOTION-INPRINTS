import { randomInt } from 'node:crypto'
import { ApiError } from './http.js'

/* Customer-facing reference numbers (Prompts 6.1, 8.3).

   Internal database ids are UUIDs and never appear in a reference. The old scheme
   embedded Date.now(), which leaked order timing and let anyone estimate volume by
   comparing two references — these are drawn from a CSPRNG instead.

   Alphabet excludes I, O, 0, 1 so a reference read over the phone or written on a
   job bag cannot be transcribed ambiguously. */

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomBlock(length) {
  let out = ''
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

export const REFERENCE_FORMATS = {
  quote_request: { prefix: 'MOT-Q', length: 6 },
  quote: { prefix: 'MOT-QT', length: 6 },
  order: { prefix: 'MOT', length: 6 },
}

/** Generates one candidate reference. Uniqueness is the caller's job — see below. */
export function makeReference(kind) {
  const format = REFERENCE_FORMATS[kind]
  if (!format) throw new Error(`Unknown reference kind: ${kind}`)
  return `${format.prefix}-${randomBlock(format.length)}`
}

/**
 * Generates a reference not already present in `table`.`column`.
 * Collisions are astronomically unlikely (32^6 ≈ 1.07e9 per prefix) but a retry
 * loop is cheaper than an occasional 500, and the unique index remains the real
 * guarantee.
 */
export async function generateReference(db, kind, { table, column, attempts = 5 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const reference = makeReference(kind)
    const existing = await db.query(`SELECT 1 FROM public.${table} WHERE ${column} = $1 LIMIT 1`, [reference])
    if (!existing.length) return reference
  }
  throw new ApiError(503, 'reference_unavailable', 'Could not allocate a reference. Please try again.')
}
