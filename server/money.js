/* Money handling for Motion.

   UGX is used in whole shillings — there is no circulating subunit — so every
   amount is an integer number of shillings inside this application. The database
   columns are numeric(14,2) and accept integers unchanged.

   Two rules, and they are the whole point of this module:

   1. Money never touches floating-point arithmetic. Integer shillings are exact
      in JavaScript well past any realistic invoice (2^53 shillings is ~9e15).
   2. Percentages are expressed in basis points and rounded at one defined place,
      so 18% VAT is `mulRate(amount, 1800)` rather than `amount * 0.18`. */

export const CURRENCY = 'UGX'

/** Parses a database numeric / JSON string / number into integer shillings. */
export function toAmount(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'string' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null
  // Database values arrive as "180000.00". Rounding here is the single place a
  // fractional shilling can be introduced, and it is deliberate.
  const shillings = Math.round(numeric)
  return Number.isSafeInteger(shillings) ? shillings : null
}

/** Serialises integer shillings for transport. Money crosses the API as a string. */
export const toWire = (amount) => (amount === null || amount === undefined ? null : String(amount))

/* numeric(14,2) holds at most 12 integer digits, so anything at or beyond a
   trillion shillings cannot be stored even though JavaScript could represent it.
   Overflow is refused rather than silently truncated by the database. */
export const MAX_AMOUNT = 999_999_999_999

function guard(value, context) {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${context} exceeded the safe integer range.`)
  if (value > MAX_AMOUNT) throw new RangeError(`${context} exceeds the maximum storable amount.`)
  return value
}

export function add(...amounts) {
  return guard(amounts.reduce((total, amount) => total + (amount || 0), 0), 'Total')
}

/** Multiplies by a whole count. Guards against a non-integer creeping in. */
export function mulQuantity(amount, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('Quantity must be a non-negative integer.')
  // Checked before multiplying, so an overflow cannot be produced and then tested.
  if (quantity !== 0 && Math.abs(amount || 0) > MAX_AMOUNT / quantity) throw new RangeError('Line total exceeds the maximum storable amount.')
  return guard((amount || 0) * quantity, 'Line total')
}

/** Applies a rate given in basis points (1800 = 18%), rounding half away from zero. */
export function mulRate(amount, basisPoints) {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new RangeError('Rate must be non-negative basis points.')
  const scaled = (amount || 0) * basisPoints
  if (!Number.isSafeInteger(scaled)) throw new RangeError('Tax calculation exceeded the safe integer range.')
  return guard(Math.round(scaled / 10000), 'Tax')
}

/** True when a value is a usable money amount. Zero is a real price; null is not. */
export const isAmount = (value) => Number.isSafeInteger(value) && value >= 0
