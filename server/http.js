export class ApiError extends Error { constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details } }
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
export const ok = (data, status = 200) => json({ data }, status)
export const fail = (error) => json({ error: { code: error.code || 'internal_error', message: error.status && error.status < 500 ? error.message : 'An unexpected error occurred.', ...(error.details ? { details: error.details } : {}) } }, error.status || 500)
export async function readJson(request) { try { return await request.json() } catch { throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.') } }
function wholeNumber(value, fallback) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback }
export function parsePaging(url) { const limit = Math.min(Math.max(wholeNumber(url.searchParams.get('limit'), 20), 1), 100); const offset = wholeNumber(url.searchParams.get('offset'), 0); return { limit, offset } }
