import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { ApiError } from './http.js'

/* Order workflow, proofs and tracking (Prompts 9.2, 9.3, 10.3).

   Two things live here that the rest of the application depends on:

   1. Which status transitions are legal. An admin may move a job forward through
      the production sequence, not sideways or backwards into an arbitrary state.
   2. The proof lifecycle, whose whole purpose is evidentiary — being able to say
      exactly which version a customer approved and when. */

/** Customer-facing wording for each internal status (Prompt 9.2). */
export const CUSTOMER_STATUS = {
  new: { label: 'Order received', description: 'We have your order and will confirm the details with you.' },
  awaiting_payment: { label: 'Awaiting payment', description: 'Payment arrangements are being confirmed.', action: 'pay' },
  artwork_required: { label: 'Artwork needed', description: 'We need your artwork before production can start.', action: 'upload_artwork' },
  artwork_received: { label: 'Artwork received', description: 'We have your artwork and are reviewing it.' },
  design_in_progress: { label: 'Design in progress', description: 'We are preparing your artwork for production.' },
  awaiting_customer_approval: { label: 'Waiting for your approval', description: 'A proof is ready for you to review.', action: 'review_proof' },
  approved: { label: 'Approved', description: 'You approved the proof. The job is queued for production.' },
  in_production: { label: 'In production', description: 'Your job is being produced.' },
  ready: { label: 'Ready', description: 'Your order is finished.', action: 'collect' },
  dispatched: { label: 'Dispatched', description: 'Your order is on its way.' },
  completed: { label: 'Completed', description: 'This order is complete.' },
  cancelled: { label: 'Cancelled', description: 'This order was cancelled.' },
}

/* The production sequence, in order. Used to decide which timeline stages are
   complete, and to render progress without inventing future dates. */
export const PRODUCTION_SEQUENCE = [
  'new', 'awaiting_payment', 'artwork_required', 'artwork_received',
  'design_in_progress', 'awaiting_customer_approval', 'approved',
  'in_production', 'ready', 'dispatched', 'completed',
]

/* Legal transitions. Anything not listed is refused server-side, so a crafted
   PATCH cannot jump a job straight from `new` to `completed` (Prompt 10.3). */
const TRANSITIONS = {
  new: ['awaiting_payment', 'artwork_required', 'design_in_progress', 'in_production', 'cancelled'],
  awaiting_payment: ['new', 'artwork_required', 'design_in_progress', 'in_production', 'cancelled'],
  artwork_required: ['artwork_received', 'cancelled'],
  artwork_received: ['design_in_progress', 'in_production', 'cancelled'],
  design_in_progress: ['awaiting_customer_approval', 'in_production', 'cancelled'],
  awaiting_customer_approval: ['design_in_progress', 'approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['dispatched', 'completed'],
  dispatched: ['completed'],
  completed: [],
  cancelled: [],
}

export function assertTransition(from, to) {
  if (from === to) throw new ApiError(409, 'status_unchanged', 'The order is already in that state.')
  const allowed = TRANSITIONS[from]
  if (!allowed) throw new ApiError(422, 'unknown_status', 'That order status is not recognised.')
  if (!allowed.includes(to)) {
    throw new ApiError(409, 'invalid_transition',
      `An order cannot move from ${CUSTOMER_STATUS[from]?.label || from} to ${CUSTOMER_STATUS[to]?.label || to}.`,
      { allowed })
  }
  return to
}

/** Builds a timeline from real history. No future dates are invented. */
export function buildTimeline(currentStatus, history = []) {
  const reached = new Map()
  for (const entry of history) if (!reached.has(entry.status_code)) reached.set(entry.status_code, entry.created_at)

  const currentIndex = PRODUCTION_SEQUENCE.indexOf(currentStatus)
  if (currentStatus === 'cancelled') {
    return [{ code: 'cancelled', ...CUSTOMER_STATUS.cancelled, state: 'current', at: reached.get('cancelled') || null }]
  }

  /* A stage is only "done" if it actually happened. Orders skip stages routinely
     — a job with artwork already in hand never awaits it — and marking a skipped
     stage complete would show a tick against something that never took place, or
     a completed stage with no date. Skipped stages are simply not shown. */
  return PRODUCTION_SEQUENCE
    .filter((code, index) => reached.has(code) || code === currentStatus || index === currentIndex + 1)
    .map((code, index, all) => ({
      code,
      ...CUSTOMER_STATUS[code],
      state: code === currentStatus
        ? 'current'
        : (reached.has(code) && PRODUCTION_SEQUENCE.indexOf(code) < currentIndex ? 'done' : 'upcoming'),
      // A timestamp exists only where history records one.
      at: reached.get(code) || null,
      isLast: index === all.length - 1,
    }))
}

/* ── Guest tracking (Prompt 9.2) ────────────────────────────────────────────
   An order number alone must never authorise access, so tracking uses a separate
   256-bit token stored as a hash. Reference numbers stay short and human; the
   token carries the security. */
export const createTrackingToken = () => randomBytes(32).toString('base64url')
export const hashTrackingToken = (token) => createHash('sha256').update(String(token)).digest('hex')

export function trackingTokenMatches(supplied, storedHash) {
  if (!supplied || !storedHash) return false
  const a = Buffer.from(hashTrackingToken(supplied))
  const b = Buffer.from(String(storedHash))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/* ── Proofs (Prompt 9.3) ───────────────────────────────────────────────────── */

/** Uploads a proof, superseding any version still awaiting a response. */
export async function createProof(db, { orderId, orderItemId = null, mediaId = null, notes = null, actorId }) {
  const [order] = await db.query('SELECT id, order_number, status_code FROM public.orders WHERE id=$1', [orderId])
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.')

  const [latest] = await db.query('SELECT id, version, customer_response_at FROM public.design_proofs WHERE order_id=$1 ORDER BY version DESC LIMIT 1', [orderId])
  const version = (latest?.version || 0) + 1
  const proofId = randomUUID()

  await db.transaction((tx) => {
    const queries = []
    // A previous version is retained as history, never overwritten.
    if (latest) {
      queries.push(tx.query(
        "UPDATE public.design_proofs SET status='superseded', superseded_at=now() WHERE id=$1 AND superseded_at IS NULL AND status='awaiting_response'",
        [latest.id]))
    }
    queries.push(tx.query(
      `INSERT INTO public.design_proofs(id, order_id, order_item_id, version, media_id, motion_notes, uploaded_by_auth_user_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'awaiting_response')`,
      [proofId, orderId, orderItemId, version, mediaId, notes, actorId]))
    // Sending a proof puts the ball in the customer's court.
    queries.push(tx.query(
      "UPDATE public.orders SET status_code='awaiting_customer_approval', requires_proof_approval=true, updated_at=now() WHERE id=$1 AND status_code <> 'cancelled'",
      [orderId]))
    queries.push(tx.query(
      "INSERT INTO public.order_status_history(order_id, status_code, changed_by_auth_user_id, note) VALUES ($1,'awaiting_customer_approval',$2,$3)",
      [orderId, actorId, `Proof v${version} sent for approval`]))
    return queries
  })

  const [created] = await db.query('SELECT * FROM public.design_proofs WHERE id=$1', [proofId])
  return created
}

/** Records a customer decision against one exact proof version. */
export async function respondToProof(db, { proof, action, comment = null, actorId = null }) {
  if (proof.superseded_at || proof.status === 'superseded') {
    throw new ApiError(409, 'proof_superseded', 'A newer version of this proof has been sent. Please review the latest one.')
  }
  if (proof.customer_response_at) {
    throw new ApiError(409, 'proof_already_answered', 'You have already responded to this version.')
  }

  const approving = action === 'approve'
  const status = approving ? 'approved' : 'changes_requested'
  const orderStatus = approving ? 'approved' : 'design_in_progress'

  const results = await db.transaction((tx) => [
    tx.query(
      `UPDATE public.design_proofs
       SET status=$1, customer_response_at=now(), customer_response_by_auth_user_id=$2, customer_comment=$3
       WHERE id=$4 AND customer_response_at IS NULL AND superseded_at IS NULL
       RETURNING id`,
      [status, actorId, comment, proof.id]),
    tx.query(
      // approved_proof_id is what the production guard checks, so it is set in
      // the same statement batch as the approval itself.
      `UPDATE public.orders SET status_code=$1, approved_proof_id=$2, updated_at=now()
       WHERE id=$3 AND status_code='awaiting_customer_approval'`,
      [orderStatus, approving ? proof.id : null, proof.order_id]),
    tx.query(
      'INSERT INTO public.order_status_history(order_id, status_code, changed_by_auth_user_id, note) VALUES ($1,$2,$3,$4)',
      [proof.order_id, orderStatus, actorId, approving ? `Proof v${proof.version} approved by customer` : `Changes requested on proof v${proof.version}`]),
  ])

  // The conditional UPDATE matched nothing: another request answered first.
  if (!results[0]?.[0]) throw new ApiError(409, 'proof_already_answered', 'This proof has already been answered.')

  const [updated] = await db.query('SELECT * FROM public.design_proofs WHERE id=$1', [proof.id])
  return updated
}

/** Customer-safe view of a proof. Internal uploader identity is not exposed. */
export const presentProof = (proof, mediaBaseUrl = null) => ({
  id: proof.id,
  version: proof.version,
  status: proof.status,
  notes: proof.motion_notes,
  createdAt: proof.created_at,
  respondedAt: proof.customer_response_at,
  comment: proof.customer_comment,
  superseded: Boolean(proof.superseded_at),
  // Private media is served through a signed download, never a permanent URL.
  preview: proof.object_key && mediaBaseUrl ? null : null,
  mediaId: proof.media_id,
})

/** Records an administrative action. Never store secrets in `detail`. */
export async function recordAudit(db, { actorId, action, entityType, entityId = null, summary = null, detail = {} }) {
  await db.query(
    'INSERT INTO public.admin_audit_log(actor_auth_user_id, action, entity_type, entity_id, summary, detail) VALUES ($1,$2,$3,$4,$5,$6)',
    [actorId || null, action, entityType, entityId, summary, JSON.stringify(detail)],
  )
}
