import { ApiError, fail, json, ok, parsePaging, readJson } from './http.js'
import { requireAdmin, requireAuth, requireCustomer, requireOwnership } from './auth.js'
import { staffBootstrap } from './staff.js'
import { buildUpdate, cartSchema, categoryPatchSchema, categorySchema, checkoutSchema, contentSchema, idSchema, orderStatusSchema, pricingRequestSchema, productPatchSchema, productSchema, profileSchema, projectIntakeSchema, projectPatchSchema, projectSchema, internalNotesSchema, proofResponseSchema, proofUploadSchema, quotePrepareSchema, quoteRequestSchema, quoteResponseSchema, uploadIntentSchema, validate } from './validation.js'
import { createObjectKey, validateUpload } from './storage.js'
import { calculatePrice, loadPricingContext } from './pricing.js'
import { CURRENCY, toWire } from './money.js'
import { checkIdempotency, convertQuoteToOrder, createOrder } from './orders.js'
import { generateReference } from './references.js'
import { QUOTE_STATUS, acceptQuote, assertAcceptable, createAccessToken, createQuote, hashToken, loadQuote, presentQuote, quoteTokenAllowsAccess } from './quotes.js'
// Category 9/10: customer portal, tracking, proofs, reorder, admin operations.
import { CUSTOMER_STATUS, assertTransition, buildTimeline, createProof, presentProof, recordAudit, respondToProof, trackingTokenMatches } from './workflow.js'
import { evaluateReorder } from './reorder.js'
import { buildReport, operationalSnapshot } from './reports.js'
import { toAmount } from './money.js'

const routes = (pathname) => pathname.replace(/^\/api/, '').split('/').filter(Boolean)
/* Every query using this list joins `categories`, which also has id, name, slug
   and description — so the columns must be table-qualified or Postgres rejects
   the statement as ambiguous. The products table is aliased `p` throughout. */
const publicProductFields = 'p.id, p.name, p.slug, p.short_description, p.description, p.category_id, p.pricing_type, p.starting_price, p.currency, p.production_lead_time'
const productColumns = { name: 'name', slug: 'slug', categoryId: 'category_id', shortDescription: 'short_description', description: 'description', pricingType: 'pricing_type', startingPrice: 'starting_price', isConfigurable: 'is_configurable', quoteRequired: 'quote_required', status: 'status' }
const categoryColumns = { name: 'name', slug: 'slug', parentId: 'parent_id', description: 'description', sortOrder: 'sort_order', isPublished: 'is_published' }
const projectColumns = { title: 'title', slug: 'slug', categoryId: 'category_id', clientName: 'client_name', location: 'location', description: 'description', completedOn: 'completed_on', isFeatured: 'is_featured', isPublished: 'is_published' }
// Public buckets are part of the published website, so only an administrator may place objects in them.
const adminOnlyPurposes = new Set(['product_image', 'project_image', 'design_proof', 'website_asset'])

// First public image for a row, as a storage object key. The key is turned into a URL
// only if a public base URL is configured; until storage is provisioned it stays null.
const mediaKey = (linkTable, column) => `(SELECT m.object_key FROM public.${linkTable} lt JOIN public.media_assets m ON m.id = lt.media_id WHERE lt.${column} = p.id AND m.visibility = 'public' ORDER BY lt.sort_order LIMIT 1) AS image_key`

/* A client's name is published only when they have permitted it, and the internal
   provenance note never leaves the server (Prompts 7.1, 7.2). Applied at the API
   boundary so no query can leak it by forgetting a column list. */
const hideUnapprovedClient = (project) => {
  const { source_reference, show_client_name, client_name, ...rest } = project
  return { ...rest, client_name: show_client_name ? client_name : null }
}

const withMediaUrl = (baseUrl) => (row) => {
  const { image_key: key, ...rest } = row
  return { ...rest, image: key && baseUrl ? `${baseUrl.replace(/\/$/, '')}/${key}` : null }
}

export function createApi({ db, authenticate = async () => null, logger = console, storage, mediaBaseUrl = null, ownerAllowedEmails = [] }) {
  const decorate = withMediaUrl(mediaBaseUrl)
  return async function api(request) {
    const started = Date.now(); const url = new URL(request.url); const parts = routes(url.pathname)
    try {
      let response
      if (request.method === 'GET' && parts[0] === 'products' && !parts[1]) response = ok((await listProducts(db, url)).map(decorate))
      else if (request.method === 'GET' && parts[0] === 'products' && parts[1]) response = ok(await productDetail(db, parts[1], decorate, mediaBaseUrl))
      else if (request.method === 'GET' && parts[0] === 'categories' && !parts[1]) response = ok(await db.query("SELECT id,name,slug,parent_id,description,sort_order FROM public.categories WHERE is_published=true ORDER BY sort_order,name"))
      else if (request.method === 'GET' && (parts[0] === 'categories' || parts[0] === 'services') && parts[1]) { const rows = await db.query('SELECT id,name,slug,parent_id,description FROM public.categories WHERE is_published=true AND slug=$1', [parts[1]]); if (!rows[0]) throw new ApiError(404, 'not_found', 'Not found.'); response = ok(rows[0]) }
      else if (request.method === 'GET' && parts[0] === 'services') response = ok(await db.query("SELECT id,name,slug,parent_id,description,sort_order FROM public.categories WHERE is_published=true ORDER BY sort_order,name"))
      else if (request.method === 'GET' && parts[0] === 'projects' && !parts[1]) response = ok((await listProjects(db, url)).map(decorate).map(hideUnapprovedClient))
      else if (request.method === 'GET' && parts[0] === 'projects' && parts[1]) { const rows = await db.query(`SELECT p.id,p.title,p.slug,p.description,p.client_name,p.show_client_name,p.introduction,p.scope_of_work,p.project_type,p.location,p.completed_on,p.category_id,c.name AS category_name,c.slug AS category_slug, ${mediaKey('project_media', 'project_id')} FROM public.projects p LEFT JOIN public.categories c ON c.id = p.category_id WHERE p.is_published=true AND p.slug=$1`, [parts[1]]); if (!rows[0]) throw new ApiError(404, 'not_found', 'Project not found.'); const project = hideUnapprovedClient(decorate(rows[0])); const gallery = await db.query("SELECT m.object_key, m.original_filename, m.orientation, m.media_kind FROM public.project_media pm JOIN public.media_assets m ON m.id = pm.media_id WHERE pm.project_id=$1 AND m.visibility='public' AND pm.retired_at IS NULL ORDER BY pm.sort_order OFFSET 1", [project.id]); project.gallery = gallery.map(item => ({ image: mediaBaseUrl ? `${mediaBaseUrl.replace(/\/$/, '')}/${item.object_key}` : null, alt: item.original_filename, orientation: item.orientation, kind: item.media_kind })); response = ok(project) }
      else if (request.method === 'GET' && parts[0] === 'search') response = ok(await search(db, url, decorate))
      else if (request.method === 'POST' && parts[0] === 'pricing' && parts[1] === 'calculate') response = ok(await priceOne(db, validate(pricingRequestSchema, await readJson(request))))
      else if (request.method === 'POST' && parts[0] === 'cart' && parts[1] === 'validate') response = ok(await validateCart(db, validate(cartSchema, await readJson(request))))
      else if (request.method === 'POST' && parts[0] === 'orders' && !parts[1]) response = await placeOrder(request, db, authenticate)
      else if (request.method === 'GET' && parts[0] === 'quotes' && parts[1] && parts[2] === 'public') response = ok(await guestQuote(db, parts[1], url))
      else if (request.method === 'POST' && parts[0] === 'quotes' && parts[1] && parts[2] === 'respond') response = ok(await respondToQuote(request, db, parts[1], url, authenticate))
      /* Scheduling is enforced in the query, so a scheduled entry is invisible
         until its window opens and disappears when it closes — without anything
         needing to run on a timer (Prompt 7.4). */
      else if (request.method === 'GET' && parts[0] === 'content' && parts[1] === 'public') response = ok(await db.query(
        `SELECT section, entry_key, value FROM public.content_entries
         WHERE (status = 'published' OR (status = 'scheduled' AND publish_from <= now()))
           AND (publish_from IS NULL OR publish_from <= now())
           AND (publish_until IS NULL OR publish_until > now())`))
      /* Staff bootstrap. Turns a verified session into an owner profile when the
         identity is on the server-side allowlist, and refuses neutrally otherwise.
         Placed before /me so it is never mistaken for customer onboarding. */
      else if (request.method === 'POST' && parts[0] === 'staff' && parts[1] === 'bootstrap') {
        response = json(await staffBootstrap(request, db, authenticate, ownerAllowedEmails), 200)
      }
      else if (request.method === 'GET' && parts[0] === 'me') { const actor = await requireCustomer(request, authenticate); response = ok(actor.profile) }
      else if (request.method === 'POST' && parts[0] === 'me') { const actor = await requireAuth(request, authenticate); const body = validate(profileSchema, await readJson(request)); if (actor.profile) throw new ApiError(409, 'profile_exists', 'A profile already exists.'); const rows = await db.query('INSERT INTO public.user_profiles(auth_user_id,role,full_name,phone,company_name) VALUES($1,$2,$3,$4,$5) RETURNING id,auth_user_id,role,full_name,phone,company_name', [actor.authUserId,'customer',body.fullName,body.phone || null,body.companyName || null]); response = ok(rows[0], 201) }
      else if (request.method === 'PATCH' && parts[0] === 'me') { const actor = await requireCustomer(request, authenticate); const body = validate(profileSchema, await readJson(request)); const rows = await db.query('UPDATE public.user_profiles SET full_name=$1,phone=$2,company_name=$3 WHERE id=$4 RETURNING id,auth_user_id,role,full_name,phone,company_name', [body.fullName,body.phone || null,body.companyName || null,actor.profile.id]); response = ok(rows[0]) }
      else if (request.method === 'GET' && parts[0] === 'orders' && !parts[1]) { const actor = await requireCustomer(request, authenticate); response = ok(await db.query('SELECT id,order_number,status_code,total_amount,currency,created_at FROM public.orders WHERE customer_id=$1 ORDER BY created_at DESC', [actor.profile.id])) }
      else if (request.method === 'GET' && parts[0] === 'orders' && parts[1] && !parts[2]) response = ok(await customerOrderDetail(db, request, parts[1], authenticate))
      /* Reorder proposes; it never repeats a charge. Every line is re-validated
         and re-priced at today's rates before the customer sees it (Prompt 9.4). */
      else if (request.method === 'GET' && parts[0] === 'orders' && parts[1] && parts[2] === 'reorder') {
        const actor = await requireCustomer(request, authenticate)
        const id = validate(idSchema, parts[1])
        const [owned] = await db.query('SELECT id, customer_id, order_number FROM public.orders WHERE id=$1', [id])
        requireOwnership(owned, actor)
        response = ok({ order: { id: owned.id, reference: owned.order_number }, ...(await evaluateReorder(db, id)) })
      }
      else if (request.method === 'GET' && parts[0] === 'orders' && parts[1] && parts[2] === 'proofs') response = ok(await customerProofs(db, request, parts[1], authenticate))
      else if (request.method === 'POST' && parts[0] === 'proofs' && parts[1] && parts[2] === 'respond') response = ok(await respondToProofRequest(db, request, parts[1], authenticate))
      /* Guest tracking. The order number alone is never sufficient; a separate
         high-entropy token is required, so references cannot be enumerated. */
      else if (request.method === 'GET' && parts[0] === 'track' && parts[1]) response = ok(await trackOrder(db, parts[1], url))
      else if (request.method === 'GET' && parts[0] === 'quotes' && !parts[1]) {
        const actor = await requireCustomer(request, authenticate)
        response = ok(await db.query(
          `SELECT qr.id AS request_id, qr.request_number, qr.project_type, qr.project_brief,
                  qr.status_code AS request_status, qr.created_at,
                  q.id AS quote_id, q.quote_number, q.version, q.status_code AS quote_status,
                  q.total_amount, q.currency, q.valid_until, q.customer_accepted_at
           FROM public.quote_requests qr
           LEFT JOIN LATERAL (
             SELECT id, quote_number, version, status_code, total_amount, currency, valid_until, customer_accepted_at
             FROM public.quotes
             WHERE quote_request_id=qr.id AND superseded_at IS NULL
             ORDER BY version DESC LIMIT 1
           ) q ON true
           WHERE qr.customer_id=$1 ORDER BY qr.created_at DESC`,
          [actor.profile.id]))
      }
      else if (request.method === 'GET' && parts[0] === 'quotes' && parts[1] && !parts[2]) {
        const actor = await requireCustomer(request, authenticate)
        const loaded = await loadQuote(db, validate(idSchema, parts[1]))
        if (loaded.quote.customer_id !== actor.profile.id) throw new ApiError(404, 'not_found', 'Quote not found.')
        response = ok(presentQuote(loaded.quote, loaded.items, loaded.changeRequests))
      }
      else if (request.method === 'POST' && parts[0] === 'quote-requests') response = await submitQuoteRequest(request, db, authenticate)
      else if (request.method === 'POST' && parts[0] === 'files' && parts[1] === 'upload-intent') response = await createUploadIntent(request, db, authenticate, storage)
      else if (request.method === 'POST' && parts[0] === 'files' && parts[1] && parts[2] === 'complete') response = await completeUpload(request, parts[1], db, authenticate, storage)
      else if (request.method === 'DELETE' && parts[0] === 'files' && parts[1] && !parts[2]) response = await removeUpload(request, parts[1], db, authenticate, storage)
      else if (request.method === 'GET' && parts[0] === 'files' && parts[1] && parts[2] === 'access') response = await getFileAccess(request, parts[1], db, authenticate, storage)
      else if (parts[0] === 'admin') response = await adminApi(request, parts.slice(1), db, authenticate)
      else throw new ApiError(404, 'not_found', 'Endpoint not found.')
      logger.info?.({ method: request.method, path: url.pathname, status: response.status, ms: Date.now() - started }, 'api_request')
      return response
    } catch (error) { logger.error?.({ method: request.method, path: url.pathname, code: error.code, ms: Date.now() - started }, 'api_error'); return fail(error) }
  }
}
/* Customer order detail and tracking (Prompts 9.1, 9.2).

   The customer view is assembled deliberately rather than by selecting `*`:
   internal notes, tracking-token hashes and staff identities must never cross
   this boundary, and an explicit column list is what guarantees that. */
const CUSTOMER_ORDER_FIELDS = `o.id, o.order_number, o.status_code, o.subtotal, o.tax_amount, o.delivery_amount,
  o.total_amount, o.currency, o.fulfilment_method, o.delivery_address, o.contact_name, o.contact_email,
  o.contact_phone, o.company_name, o.notes, o.quote_id, o.requires_proof_approval, o.approved_proof_id, o.created_at`

async function assembleOrderView(db, order) {
  const [items, history, proofs, payments] = await Promise.all([
    db.query(`SELECT id, title, quantity, unit_price, line_total, configuration, design_service_required, artwork_status
              FROM public.order_items WHERE order_id=$1 ORDER BY id`, [order.id]),
    db.query('SELECT status_code, note, created_at FROM public.order_status_history WHERE order_id=$1 ORDER BY created_at', [order.id]),
    db.query(`SELECT id, version, status, motion_notes, created_at, customer_response_at, customer_comment, superseded_at, media_id
              FROM public.design_proofs WHERE order_id=$1 ORDER BY version DESC`, [order.id]),
    db.query('SELECT status, amount, currency, created_at FROM public.payments WHERE order_id=$1 ORDER BY created_at DESC', [order.id]),
  ])

  const settled = payments.find(payment => payment.status === 'successful')
  const active = proofs.find(proof => !proof.superseded_at && proof.status === 'awaiting_response')
  const customerStatus = CUSTOMER_STATUS[order.status_code] || { label: order.status_code }

  return {
    id: order.id,
    reference: order.order_number,
    status: order.status_code,
    statusLabel: customerStatus.label,
    statusDescription: customerStatus.description || null,
    // The single next thing the customer can do, or null. Surfacing an action
    // that does not apply is worse than surfacing none (Prompt 9.1).
    action: customerStatus.action || (active ? 'review_proof' : null),
    currency: order.currency,
    subtotal: toWire(toAmount(order.subtotal)),
    taxAmount: toWire(toAmount(order.tax_amount)),
    deliveryAmount: toWire(toAmount(order.delivery_amount)),
    total: toWire(toAmount(order.total_amount)),
    fulfilmentMethod: order.fulfilment_method,
    deliveryAddress: order.delivery_address,
    contactName: order.contact_name,
    company: order.company_name,
    customerNotes: order.notes,
    quoteId: order.quote_id,
    createdAt: order.created_at,
    paymentStatus: settled ? 'paid' : (payments[0]?.status || 'unpaid'),
    items: items.map(item => ({
      id: item.id, title: item.title, quantity: item.quantity,
      unitPrice: toWire(toAmount(item.unit_price)), lineTotal: toWire(toAmount(item.line_total)),
      configuration: item.configuration || {},
      designServiceRequired: item.design_service_required,
      artworkStatus: item.artwork_status,
    })),
    timeline: buildTimeline(order.status_code, history),
    activeProof: active ? { id: active.id, version: active.version, notes: active.motion_notes, createdAt: active.created_at } : null,
    proofs: proofs.map(proof => ({
      id: proof.id, version: proof.version, status: proof.status,
      notes: proof.motion_notes, createdAt: proof.created_at,
      respondedAt: proof.customer_response_at, comment: proof.customer_comment,
      superseded: Boolean(proof.superseded_at),
    })),
  }
}

async function customerOrderDetail(db, request, orderId, authenticate) {
  const actor = await requireCustomer(request, authenticate)
  const [order] = await db.query(`SELECT ${CUSTOMER_ORDER_FIELDS}, o.customer_id FROM public.orders o WHERE o.id=$1`, [validate(idSchema, orderId)])
  requireOwnership(order, actor)
  return assembleOrderView(db, order)
}

/* Guest tracking. The reference identifies; the token authorises. A wrong token
   returns the same 404 as an unknown reference, so references cannot be probed. */
async function trackOrder(db, reference, url) {
  const token = url.searchParams.get('token')
  if (!token) throw new ApiError(404, 'not_found', 'Order not found.')
  const [order] = await db.query(`SELECT ${CUSTOMER_ORDER_FIELDS}, o.tracking_token FROM public.orders o WHERE o.order_number=$1`, [String(reference).slice(0, 40)])
  if (!order || !trackingTokenMatches(token, order.tracking_token)) throw new ApiError(404, 'not_found', 'Order not found.')

  const view = await assembleOrderView(db, order)

  /* A tracking link may be forwarded, printed on a job bag or read over a
     shoulder. Whoever holds it learns where the job has got to and nothing else.
     Built by explicit allowlist rather than by deleting fields from the customer
     view — deletion is a list that silently stops being complete the moment
     another field is added upstream. */
  return {
    reference: view.reference,
    status: view.status,
    statusLabel: view.statusLabel,
    statusDescription: view.statusDescription,
    fulfilmentMethod: view.fulfilmentMethod,
    paymentStatus: view.paymentStatus,
    createdAt: view.createdAt,
    timeline: view.timeline,
    // Item titles and quantities identify the job; configuration, prices,
    // artwork state and internal notes do not belong to a tracking view.
    items: view.items.map(item => ({ title: item.title, quantity: item.quantity })),
    // Progress is visible; the customer's address, contact details, order value
    // and notes are not.
  }
}

async function customerProofs(db, request, orderId, authenticate) {
  const actor = await requireCustomer(request, authenticate)
  const id = validate(idSchema, orderId)
  const [order] = await db.query('SELECT id, customer_id FROM public.orders WHERE id=$1', [id])
  requireOwnership(order, actor)
  const proofs = await db.query('SELECT * FROM public.design_proofs WHERE order_id=$1 ORDER BY version DESC', [id])
  return proofs.map(proof => presentProof(proof))
}

/* A customer may only answer a proof on their own order, and only the version
   that is currently awaiting a response (Prompt 9.3). */
async function respondToProofRequest(db, request, proofId, authenticate) {
  const actor = await requireCustomer(request, authenticate)
  const body = validate(proofResponseSchema, await readJson(request))
  const [proof] = await db.query(
    `SELECT p.*, o.customer_id FROM public.design_proofs p JOIN public.orders o ON o.id = p.order_id WHERE p.id=$1`,
    [validate(idSchema, proofId)])
  if (!proof || proof.customer_id !== actor.profile.id) throw new ApiError(404, 'not_found', 'Proof not found.')
  const updated = await respondToProof(db, { proof, action: body.action, comment: body.comment || null, authUserId: actor.authUserId })
  return presentProof(updated)
}

/* Project intake (Prompt 6.1). Type-specific answers are stored as a document, so
   a signage enquiry and a POS enquiry share one endpoint without one of them
   carrying a column of nulls. The reference is random, not sequential. */
async function submitQuoteRequest(request, db, authenticate) {
  const raw = await readJson(request)
  // Both shapes are accepted: the richer intake form and the simple contact form.
  const body = raw.projectType
    ? validate(projectIntakeSchema, raw)
    : { ...validate(quoteRequestSchema, raw), projectType: null, answers: {} }
  const actor = await authenticate(request).catch(() => null)
  const reference = await generateReference(db, 'quote_request', { table: 'quote_requests', column: 'request_number' })

  const rows = await db.query(
    `INSERT INTO public.quote_requests(request_number, customer_id, contact_name, contact_email, contact_phone,
                                       project_brief, status_code, project_type, answers, preferred_contact, desired_timeline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, request_number, status_code, created_at`,
    [reference, actor?.profile?.id || null, body.contactName, body.contactEmail, body.contactPhone || null,
      body.projectBrief, 'submitted', body.projectType || null, JSON.stringify(body.answers || {}),
      body.preferredContact || null, body.desiredTimeline || null],
  )
  return json({ data: rows[0] }, 201)
}

/* Checkout (Prompts 8.1, 8.3).

   Guest-first: an account is never required to place an order. Everything about
   money is recalculated here — the request carries products, quantities, options
   and contact details, and nothing else is read. */
async function placeOrder(request, db, authenticate) {
  const body = validate(checkoutSchema, await readJson(request))
  const actor = await authenticate(request).catch(() => null)
  // An idempotency key makes a double-submitted checkout return the first order
  // rather than creating a second one.
  const key = request.headers.get('idempotency-key') || body.idempotencyKey || null
  const idempotency = key ? { key, scope: 'checkout', request: body } : null

  // A replay short-circuits before any pricing work is repeated.
  const replay = await checkIdempotency(db, idempotency || {})
  if (replay) return json({ data: replay }, 200)

  const order = await createOrder(db, {
    items: body.items,
    contact: body.contact,
    fulfilment: body.fulfilment,
    deliveryAmount: 0, // Delivery pricing is a business rule that does not exist yet.
    customerId: actor?.profile?.id || null,
    authUserId: actor?.authUserId || null,
    notes: body.notes || null,
    idempotency,
  })

  return json({ data: order }, 201)
}

/* A quote can be opened by its owner, or by a guest holding the emailed link.
   The token is compared in constant time and the quote id alone is never enough. */
async function guestQuote(db, quoteId, url) {
  const id = validate(idSchema, quoteId)
  const { quote, items, changeRequests } = await loadQuote(db, id)
  if (!quoteTokenAllowsAccess(quote, url.searchParams.get('token'))) {
    // Same response as a missing quote, so a valid id cannot be confirmed by probing.
    throw new ApiError(404, 'not_found', 'Quote not found.')
  }
  return presentQuote(quote, items, changeRequests)
}

async function respondToQuote(request, db, quoteId, url, authenticate) {
  const id = validate(idSchema, quoteId)
  const body = validate(quoteResponseSchema, await readJson(request))
  const { quote } = await loadQuote(db, id)

  const actor = await authenticate(request).catch(() => null)
  const holdsToken = quoteTokenAllowsAccess(quote, url.searchParams.get('token') || body.token)
  const owns = actor?.profile?.id && quote.customer_id && actor.profile.id === quote.customer_id
  if (!holdsToken && !owns) throw new ApiError(404, 'not_found', 'Quote not found.')

  if (body.action === 'accept') {
    const accepted = await acceptQuote(db, quote, { authUserId: actor?.authUserId || null })
    return presentQuote(accepted, (await loadQuote(db, id)).items)
  }

  if (body.action === 'decline') {
    assertAcceptable(quote)
    const [declined] = await db.query(
      `WITH declined AS (
         UPDATE public.quotes SET status_code=$1, declined_at=now(), updated_at=now()
         WHERE id=$2 AND customer_accepted_at IS NULL AND superseded_at IS NULL
           AND status_code IN ('sent', 'changes_requested')
         RETURNING *
       ), history AS (
         INSERT INTO public.quote_status_history(quote_id, status_code, note)
         SELECT id, $1, 'Declined by customer' FROM declined
       )
       SELECT * FROM declined`,
      [QUOTE_STATUS.declined, id])
    if (!declined) throw new ApiError(409, 'quote_not_open', 'This quote can no longer be declined.')
    return presentQuote(declined)
  }

  // Changes requested: the quote is never overwritten, only annotated.
  assertAcceptable(quote)
  const [updated] = await db.query(
    `WITH changed AS (
       UPDATE public.quotes SET status_code=$1, updated_at=now()
       WHERE id=$2 AND customer_accepted_at IS NULL AND superseded_at IS NULL
         AND status_code IN ('sent', 'changes_requested')
       RETURNING *
     ), request AS (
       INSERT INTO public.quote_change_requests(quote_id, message, requested_by_auth_user_id)
       SELECT id, $3, $4 FROM changed
     ), history AS (
       INSERT INTO public.quote_status_history(quote_id, status_code, changed_by_auth_user_id, note)
       SELECT id, $1, $4, 'Changes requested by customer' FROM changed
     )
     SELECT * FROM changed`,
    [QUOTE_STATUS.changes_requested, id, body.message, actor?.authUserId || null])
  if (!updated) throw new ApiError(409, 'quote_not_open', 'This quote can no longer be changed.')
  const reloaded = await loadQuote(db, id)
  return presentQuote(updated, reloaded.items, reloaded.changeRequests)
}

/* Product detail carries its own option definitions, so the configuration panel is
   built from data rather than from per-product code in the frontend (Prompt 5.2). */
async function productDetail(db, slug, decorate, mediaBaseUrl) {
  const rows = await db.query(
    `SELECT p.id, p.name, p.slug, p.short_description, p.description, p.category_id, p.pricing_type, p.starting_price,
            p.currency, p.production_lead_time, p.quote_required, p.is_configurable, p.min_quantity, p.max_quantity,
            p.artwork_requirement, c.name AS category_name, c.slug AS category_slug,
            ${mediaKey('product_media', 'product_id')}
     FROM public.products p LEFT JOIN public.categories c ON c.id = p.category_id
     WHERE p.slug=$1 AND p.status='published'`, [slug])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'Product not found.')
  const product = decorate(rows[0])

  const [assignments, values, gallery, specifications, relatedProducts] = await Promise.all([
    db.query(`SELECT o.id, o.code, o.name, o.input_type, a.is_required, a.sort_order, a.group_label, a.help_text, a.default_value
              FROM public.product_option_assignments a JOIN public.product_options o ON o.id = a.option_id
              WHERE a.product_id=$1 ORDER BY a.sort_order, o.name`, [product.id]),
    db.query(`SELECT v.id, v.option_id, v.value, v.label, v.sort_order, v.surcharge, v.surcharge_kind, v.requires_quote
              FROM public.product_option_values v JOIN public.product_option_assignments a ON a.option_id = v.option_id
              WHERE a.product_id=$1 AND v.is_active = true ORDER BY v.sort_order, v.label`, [product.id]),
    db.query(`SELECT m.object_key, m.original_filename FROM public.product_media pm JOIN public.media_assets m ON m.id = pm.media_id
              WHERE pm.product_id=$1 AND m.visibility='public' ORDER BY pm.sort_order`, [product.id]),
    db.query('SELECT label, value FROM public.product_specifications WHERE product_id=$1 ORDER BY sort_order, label', [product.id]),
    db.query(`SELECT ${publicProductFields}, c.name AS category_name, c.slug AS category_slug,
                     ${mediaKey('product_media', 'product_id')}
              FROM public.related_products rp
              JOIN public.products p ON p.id = rp.related_product_id
              LEFT JOIN public.categories c ON c.id = p.category_id
              WHERE rp.product_id=$1 AND p.status='published'
              ORDER BY rp.sort_order, p.name LIMIT 4`, [product.id]),
  ])

  // Surcharges are exposed as labels only where they help the customer choose;
  // the amount that matters is the one /pricing/calculate returns.
  product.options = assignments.map(option => ({
    ...option,
    values: values.filter(value => value.option_id === option.id).map(({ option_id, ...value }) => value),
  }))
  product.gallery = gallery.map(item => ({
    image: mediaBaseUrl ? `${mediaBaseUrl.replace(/\/$/, '')}/${item.object_key}` : null,
    alt: item.original_filename,
  }))
  product.specifications = specifications
  product.related_products = relatedProducts.map(decorate)
  return product
}

/* Pricing and cart validation (Prompts 5.3, 5.4).

   Both recalculate from the database every time. Nothing a browser sends about
   money is read — a request carries a product, a quantity and a set of option
   choices, and the server decides what that costs. A cart is therefore just a
   list of intents until the server prices it. */
async function priceOne(db, body) {
  const context = await loadPricingContext(db, { slug: body.slug, productId: body.productId })
  const quote = calculatePrice({ ...context, selection: body.selection, quantity: body.quantity })
  return { product: { id: context.product.id, slug: context.product.slug, name: context.product.name }, ...quote }
}

async function validateCart(db, body) {
  const items = []
  let subtotal = 0
  let priced = true

  for (const line of body.items) {
    // Each line is re-priced independently so one invalid item cannot poison the rest.
    try {
      const context = await loadPricingContext(db, { productId: line.productId })
      const quote = calculatePrice({ ...context, selection: line.selection, quantity: line.quantity })
      const changed = line.total !== undefined && line.total !== null && String(line.total) !== String(quote.total)
      items.push({
        key: line.key,
        productId: context.product.id,
        slug: context.product.slug,
        name: context.product.name,
        available: true,
        // A quote-only configuration is never purchasable, so it can never sit in
        // the cart as a priced line (Prompt 5.4).
        purchasable: !quote.quoteRequired,
        priceChanged: changed,
        artworkRequirement: context.product.artwork_requirement,
        designServiceRequired: quote.selection.design === true || quote.selection.design_service === true,
        ...quote,
      })
      if (quote.quoteRequired) priced = false
      else subtotal += Number(quote.total)
    } catch (error) {
      items.push({
        key: line.key,
        productId: line.productId,
        available: false,
        purchasable: false,
        // 404 means withdrawn; 422 means the saved configuration is no longer valid.
        reason: error.status === 404 ? 'This product is no longer available.' : (error.message || 'This item can no longer be ordered.'),
        issues: error.details || null,
      })
      priced = false
    }
  }

  return {
    items,
    currency: CURRENCY,
    subtotal: priced ? toWire(subtotal) : null,
    valid: items.every(item => item.available && item.purchasable && !item.priceChanged),
  }
}

/* Public listings support the filters the storefront actually uses: category slug
   (including a parent's children), featured, and a sort whitelist. Sort values are
   mapped through a fixed table so no request text ever reaches the SQL string. */
const productSorts = { featured: 'p.is_featured DESC, p.published_at DESC NULLS LAST', newest: 'p.published_at DESC NULLS LAST', name: 'p.name ASC', 'price-asc': 'p.starting_price ASC NULLS LAST', 'price-desc': 'p.starting_price DESC NULLS LAST' }

async function listProducts(db, url) {
  const { limit, offset } = parsePaging(url)
  const category = url.searchParams.get('category')
  const featured = url.searchParams.get('featured') === 'true'
  const term = (url.searchParams.get('q') || '').trim()
  const sort = productSorts[url.searchParams.get('sort')] || productSorts.newest
  const where = ["p.status='published'"]
  const values = []
  if (category) { values.push(category); where.push(`(c.slug = $${values.length} OR parent.slug = $${values.length})`) }
  if (featured) where.push('p.is_featured = true')
  if (term.length >= 2) {
    values.push(`%${term.replace(/[%_]/g, match => `\\${match}`)}%`)
    where.push(`(p.name ILIKE $${values.length} ESCAPE '\\' OR p.short_description ILIKE $${values.length} ESCAPE '\\' OR p.description ILIKE $${values.length} ESCAPE '\\')`)
  }
  values.push(limit, offset)
  return db.query(
    `SELECT ${publicProductFields}, c.name AS category_name, c.slug AS category_slug, ${mediaKey('product_media', 'product_id')}
     FROM public.products p
     LEFT JOIN public.categories c ON c.id = p.category_id
     LEFT JOIN public.categories parent ON parent.id = c.parent_id
     WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
}

async function listProjects(db, url) {
  const { limit, offset } = parsePaging(url)
  const category = url.searchParams.get('category')
  const featured = url.searchParams.get('featured') === 'true'
  const exclude = url.searchParams.get('exclude')
  const where = ['p.is_published=true']
  const values = []
  if (category) { values.push(category); where.push(`(c.slug = $${values.length} OR parent.slug = $${values.length})`) }
  if (featured) where.push('p.is_featured = true')
  if (exclude) { values.push(exclude); where.push(`p.slug <> $${values.length}`) }
  values.push(limit, offset)
  return db.query(
    `SELECT p.id,p.title,p.slug,p.description,p.client_name,p.show_client_name,p.project_type,p.location,p.completed_on,p.is_featured,c.name AS category_name,c.slug AS category_slug, ${mediaKey('project_media', 'project_id')}
     FROM public.projects p
     LEFT JOIN public.categories c ON c.id = p.category_id
     LEFT JOIN public.categories parent ON parent.id = c.parent_id
     WHERE ${where.join(' AND ')} ORDER BY p.is_featured DESC, p.completed_on DESC NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
}

/* Search across the three public record types. Deliberately simple and explicit:
   case-insensitive prefix/substring matching over indexed public columns, grouped
   by type. No inferred ranking, no recommendation model. */
async function search(db, url, decorate) {
  const term = (url.searchParams.get('q') || '').trim()
  if (term.length < 2) return { term, products: [], services: [], projects: [] }
  const pattern = `%${term.replace(/[%_]/g, match => `\\${match}`)}%`
  const [products, services, projects] = await Promise.all([
    db.query(`SELECT ${publicProductFields}, c.name AS category_name, c.slug AS category_slug, ${mediaKey('product_media', 'product_id')} FROM public.products p LEFT JOIN public.categories c ON c.id = p.category_id WHERE p.status='published' AND (p.name ILIKE $1 OR p.short_description ILIKE $1) ORDER BY p.name LIMIT 6`, [pattern]),
    db.query('SELECT id,name,slug,description FROM public.categories WHERE is_published=true AND name ILIKE $1 ORDER BY sort_order,name LIMIT 6', [pattern]),
    db.query(`SELECT p.id,p.title,p.slug,p.location,p.completed_on,c.name AS category_name, ${mediaKey('project_media', 'project_id')} FROM public.projects p LEFT JOIN public.categories c ON c.id = p.category_id WHERE p.is_published=true AND (p.title ILIKE $1 OR p.description ILIKE $1) ORDER BY p.completed_on DESC NULLS LAST LIMIT 6`, [pattern]),
  ])
  return { term, products: products.map(decorate), services, projects: projects.map(decorate) }
}

async function adminApi(request, parts, db, authenticate) {
  const admin = await requireAdmin(request, authenticate)

  /* ── Dashboard and reports (Prompts 10.1, 10.6) ─────────────────────────── */
  if (request.method === 'GET' && parts[0] === 'dashboard') return ok(await operationalSnapshot(db))
  if (request.method === 'GET' && parts[0] === 'reports') {
    const url = new URL(request.url)
    return ok(await buildReport(db, {
      range: url.searchParams.get('range') || 'this_month',
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    }))
  }

  /* ── Orders and production (Prompt 10.3) ────────────────────────────────── */
  if (request.method === 'GET' && parts[0] === 'orders' && parts[1] && !parts[2]) {
    const id = validate(idSchema, parts[1])
    const [order] = await db.query('SELECT * FROM public.orders WHERE id=$1', [id])
    if (!order) throw new ApiError(404, 'not_found', 'Order not found.')
    const view = await assembleOrderView(db, order)
    // Staff see the operational record; customers never do.
    const [artwork, audit] = await Promise.all([
      db.query(`SELECT m.id, m.original_filename, m.mime_type, m.byte_size, m.purpose, m.created_at, oim.order_item_id
                FROM public.order_item_media oim JOIN public.media_assets m ON m.id = oim.media_id
                JOIN public.order_items oi ON oi.id = oim.order_item_id WHERE oi.order_id=$1`, [id]),
      db.query('SELECT action, summary, created_at FROM public.admin_audit_log WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at DESC LIMIT 25', ['order', id]),
    ])
    return ok({ ...view, internalNotes: order.internal_notes, customerId: order.customer_id, artwork, audit })
  }

  if (request.method === 'PATCH' && parts[0] === 'orders' && parts[1] && parts[2] === 'notes') {
    const body = validate(internalNotesSchema, await readJson(request))
    const id = validate(idSchema, parts[1])
    const [updated] = await db.query('UPDATE public.orders SET internal_notes=$1, updated_at=now() WHERE id=$2 RETURNING id', [body.notes, id])
    if (!updated) throw new ApiError(404, 'not_found', 'Order not found.')
    await recordAudit(db, { actorAuthUserId: admin.authUserId, action: 'order.notes_updated', entityType: 'order', entityId: id })
    return ok({ id, updated: true })
  }

  /* ── Proofs (Prompt 9.3, admin side) ────────────────────────────────────── */
  if (request.method === 'POST' && parts[0] === 'orders' && parts[1] && parts[2] === 'proofs') {
    const body = validate(proofUploadSchema, await readJson(request))
    const id = validate(idSchema, parts[1])
    const proof = await createProof(db, { orderId: id, orderItemId: body.orderItemId || null, mediaId: body.mediaId || null, notes: body.notes || null, authUserId: admin.authUserId })
    await recordAudit(db, { actorAuthUserId: admin.authUserId, action: 'proof.uploaded', entityType: 'order', entityId: id, summary: `Proof v${proof.version} sent` })
    return ok(presentProof(proof), 201)
  }

  /* ── Customers (Prompt 10.4) ────────────────────────────────────────────── */
  if (request.method === 'GET' && parts[0] === 'customers' && !parts[1]) {
    const url = new URL(request.url)
    const { limit, offset } = parsePaging(url)
    const term = (url.searchParams.get('q') || '').trim()
    const values = []
    let where = "p.role = 'customer'"
    if (term.length >= 2) { values.push(`%${term.replace(/[%_]/g, m => `\\${m}`)}%`); where += ` AND (p.full_name ILIKE $1 ESCAPE '\\' OR p.phone ILIKE $1 ESCAPE '\\' OR p.company_name ILIKE $1 ESCAPE '\\')` }
    values.push(limit, offset)
    // Authentication material is never selected — not hashes, not tokens, not claims.
    return ok(await db.query(
      `SELECT p.id, p.full_name, p.phone, p.company_name, p.created_at,
              (SELECT COUNT(*) FROM public.orders o WHERE o.customer_id = p.id)::int AS order_count,
              (SELECT COALESCE(SUM(o.total_amount),0) FROM public.orders o WHERE o.customer_id = p.id AND o.status_code <> 'cancelled') AS lifetime_value
       FROM public.user_profiles p WHERE ${where}
       ORDER BY p.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values))
  }

  if (request.method === 'GET' && parts[0] === 'customers' && parts[1]) {
    const id = validate(idSchema, parts[1])
    const [profile] = await db.query('SELECT id, full_name, phone, company_name, role, created_at FROM public.user_profiles WHERE id=$1', [id])
    if (!profile) throw new ApiError(404, 'not_found', 'Customer not found.')
    const [orders, quotes] = await Promise.all([
      db.query('SELECT id, order_number, status_code, total_amount, currency, created_at FROM public.orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 50', [id]),
      db.query('SELECT id, request_number, project_type, status_code, created_at FROM public.quote_requests WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 50', [id]),
    ])
    return ok({ profile, orders, quotes })
  }

  /* ── Audit log (Prompt 10.7) ────────────────────────────────────────────── */
  if (request.method === 'GET' && parts[0] === 'audit') {
    const { limit, offset } = parsePaging(new URL(request.url))
    return ok(await db.query(
      'SELECT actor_auth_user_id, action, entity_type, entity_id, summary, created_at FROM public.admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]))
  }

  if (request.method === 'POST' && parts[0] === 'products') { const body = validate(productSchema, await readJson(request)); const rows = await db.query('INSERT INTO public.products(name,slug,category_id,short_description,description,pricing_type,starting_price,is_configurable,quote_required,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,slug,status', [body.name,body.slug,body.categoryId || null,body.shortDescription || null,body.description || null,body.pricingType,body.startingPrice ?? null,body.isConfigurable,body.quoteRequired,body.status]); return ok(rows[0], 201) }
  if (request.method === 'PATCH' && parts[0] === 'products' && parts[1]) { const body = validate(productPatchSchema, await readJson(request)); const id = validate(idSchema,parts[1]); const { assignments, values } = buildUpdate(productColumns, body); const rows = await db.query(`UPDATE public.products SET ${assignments.join(',')} WHERE id=$${values.length + 1} RETURNING id,slug,status`, [...values,id]); if (!rows[0]) throw new ApiError(404,'not_found','Product not found.'); return ok(rows[0]) }
  if (request.method === 'DELETE' && parts[0] === 'products' && parts[1]) { const rows = await db.query("UPDATE public.products SET status='archived' WHERE id=$1 RETURNING id,status", [validate(idSchema,parts[1])]); if (!rows[0]) throw new ApiError(404,'not_found','Product not found.'); return ok(rows[0]) }
  if (request.method === 'GET' && parts[0] === 'categories') return ok(await db.query('SELECT id,name,slug,parent_id,description,sort_order,is_published FROM public.categories ORDER BY sort_order,name'))
  if (request.method === 'POST' && parts[0] === 'categories') { const body = validate(categorySchema, await readJson(request)); const rows = await db.query('INSERT INTO public.categories(name,slug,parent_id,description,sort_order,is_published) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,slug', [body.name,body.slug,body.parentId || null,body.description || null,body.sortOrder,body.isPublished]); return ok(rows[0],201) }
  if (request.method === 'PATCH' && parts[0] === 'categories' && parts[1]) { const body = validate(categoryPatchSchema, await readJson(request)); const id = validate(idSchema,parts[1]); const { assignments, values } = buildUpdate(categoryColumns, body); const rows = await db.query(`UPDATE public.categories SET ${assignments.join(',')} WHERE id=$${values.length + 1} RETURNING id,slug`, [...values,id]); if (!rows[0]) throw new ApiError(404,'not_found','Category not found.'); return ok(rows[0]) }
  if (request.method === 'GET' && parts[0] === 'orders') { const { limit, offset } = parsePaging(new URL(request.url)); return ok(await db.query('SELECT id,order_number,customer_id,status_code,total_amount,currency,created_at FROM public.orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset])) }
  if (request.method === 'GET' && parts[0] === 'quotes') { const { limit, offset } = parsePaging(new URL(request.url)); return ok(await db.query('SELECT id,request_number,customer_id,status_code,contact_name,contact_email,created_at FROM public.quote_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset])) }
  /* Prepare a quote, or a revision that supersedes one. Staff only — requireAdmin
     has already run for every path in this function. */
  if (request.method === 'POST' && parts[0] === 'quotes' && !parts[1]) {
    const body = validate(quotePrepareSchema, await readJson(request))
    const created = await createQuote(db, { ...body, authUserId: admin.authUserId })
    return ok(presentQuote(created), 201)
  }

  /* Sending is the moment a guest credential is minted. Its plaintext is returned
     once; only the hash is stored. Status and history change atomically. */
  if (request.method === 'POST' && parts[0] === 'quotes' && parts[1] && parts[2] === 'send') {
    const id = validate(idSchema, parts[1])
    const accessToken = createAccessToken()
    const [sent] = await db.query(
      `WITH sent AS (
         UPDATE public.quotes
         SET status_code=$1, sent_at=now(), access_token=$2, access_token_expires_at=$3,
             access_token_revoked_at=NULL, updated_at=now()
         WHERE id=$4 AND status_code='prepared' AND customer_accepted_at IS NULL AND superseded_at IS NULL
         RETURNING *
       ), history AS (
         INSERT INTO public.quote_status_history(quote_id, status_code, changed_by_auth_user_id, note)
         SELECT id, $1, $5, 'Sent to customer' FROM sent
       )
       SELECT * FROM sent`,
      [QUOTE_STATUS.sent, hashToken(accessToken), new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(), id, admin.authUserId])
    if (!sent) throw new ApiError(409, 'quote_not_sendable', 'This quote cannot be sent in its current state.')
    return ok({ ...presentQuote(sent), accessToken })
  }

  if (request.method === 'POST' && parts[0] === 'quotes' && parts[1] && parts[2] === 'token' && parts[3] === 'rotate') {
    const id = validate(idSchema, parts[1])
    const accessToken = createAccessToken()
    const [rotated] = await db.query(
      `UPDATE public.quotes
       SET access_token=$1, access_token_expires_at=$2, access_token_revoked_at=NULL, updated_at=now()
       WHERE id=$3 AND sent_at IS NOT NULL RETURNING *`,
      [hashToken(accessToken), new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(), id])
    if (!rotated) throw new ApiError(409, 'quote_token_unavailable', 'A token can be rotated only after the quote has been sent.')
    return ok({ ...presentQuote(rotated), accessToken })
  }

  if (request.method === 'POST' && parts[0] === 'quotes' && parts[1] && parts[2] === 'token' && parts[3] === 'revoke') {
    const id = validate(idSchema, parts[1])
    const [revoked] = await db.query(
      'UPDATE public.quotes SET access_token_revoked_at=now(), updated_at=now() WHERE id=$1 AND access_token IS NOT NULL RETURNING *',
      [id])
    if (!revoked) throw new ApiError(404, 'not_found', 'Quote token not found.')
    return ok(presentQuote(revoked))
  }

  /* Convert an accepted quote into an order. Guarded against duplicate conversion,
     expiry and any divergence from the accepted total (Prompt 6.4). */
  if (request.method === 'POST' && parts[0] === 'quotes' && parts[1] && parts[2] === 'convert') {
    const id = validate(idSchema, parts[1])
    const { quote, items } = await loadQuote(db, id)
    const [profile] = quote.customer_id ? await db.query('SELECT full_name, phone FROM public.user_profiles WHERE id=$1', [quote.customer_id]) : []
    const order = await convertQuoteToOrder(db, {
      quote,
      items,
      customerId: quote.customer_id || null,
      authUserId: admin.authUserId,
      contact: { name: profile?.full_name || quote.contact_name || 'Customer', email: quote.contact_email, phone: profile?.phone || null },
    })
    return ok(order, 201)
  }

  if (request.method === 'POST' && parts[0] === 'projects') { const body = validate(projectSchema,await readJson(request)); const rows = await db.query('INSERT INTO public.projects(title,slug,category_id,client_name,location,description,completed_on,is_featured,is_published,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9 THEN now() ELSE NULL END) RETURNING id,slug',[body.title,body.slug,body.categoryId || null,body.clientName || null,body.location || null,body.description || null,body.completedOn || null,body.isFeatured,body.isPublished]); return ok(rows[0],201) }
  if (request.method === 'PATCH' && parts[0] === 'projects' && parts[1]) { const body = validate(projectPatchSchema,await readJson(request)); const id = validate(idSchema,parts[1]); const { assignments, values, placeholders } = buildUpdate(projectColumns, body); if (placeholders.isPublished) assignments.push(`published_at=CASE WHEN $${placeholders.isPublished} AND published_at IS NULL THEN now() WHEN NOT $${placeholders.isPublished} THEN NULL ELSE published_at END`); const rows = await db.query(`UPDATE public.projects SET ${assignments.join(',')} WHERE id=$${values.length + 1} RETURNING id,slug`,[...values,id]); if (!rows[0]) throw new ApiError(404,'not_found','Project not found.'); return ok(rows[0]) }
  // Scoped to a single entry: a section may hold several keys, and one PATCH must never overwrite them all.
  /* `status` is the single source of truth for visibility; `is_published` is kept
     in step only so any older reader stays consistent. Writing one without the
     other is what let an administrator "publish" content that stayed invisible. */
  if (request.method === 'PATCH' && parts[0] === 'content' && parts[1]) {
    const body = validate(contentSchema, await readJson(request))
    const entryKey = parts[2] || body.entryKey
    const status = body.status || (body.isPublished === true ? 'published' : body.isPublished === false ? 'draft' : null)
    const leavingSchedule = status !== null && status !== 'scheduled'
    const hasPublishFrom = Object.prototype.hasOwnProperty.call(body, 'publishFrom') || leavingSchedule
    const hasPublishUntil = Object.prototype.hasOwnProperty.call(body, 'publishUntil') || leavingSchedule
    const value = Object.prototype.hasOwnProperty.call(body, 'value') ? JSON.stringify(body.value) : null
    const rows = await db.query(
      `UPDATE public.content_entries
       SET value = COALESCE($1::jsonb, value),
           status = COALESCE($2, status),
           is_published = (COALESCE($2, status) = 'published'),
           publish_from = CASE WHEN $3 THEN $4::timestamptz ELSE publish_from END,
           publish_until = CASE WHEN $5 THEN $6::timestamptz ELSE publish_until END,
           updated_by_auth_user_id = $7,
           updated_at = now()
       WHERE section = $8 AND entry_key = $9
       RETURNING id, section, entry_key, value, status, publish_from, publish_until`,
      [value, status, hasPublishFrom, body.publishFrom ?? null, hasPublishUntil, body.publishUntil ?? null,
        admin.authUserId, parts[1], entryKey])
    if (!rows[0]) throw new ApiError(404, 'not_found', 'Content entry not found.')
    return ok(rows[0])
  }
  /* Production transitions are validated against the workflow, so a crafted
     request cannot move a job sideways or straight to completed. The database
     additionally refuses production entry without an approved proof where one is
     required, which no route can bypass (Prompt 10.3). */
  if (request.method === 'PATCH' && parts[0] === 'orders' && parts[1] && parts[2] === 'status') {
    const body = validate(orderStatusSchema, await readJson(request))
    const id = validate(idSchema, parts[1])
    const [current] = await db.query('SELECT id, order_number, status_code FROM public.orders WHERE id=$1', [id])
    if (!current) throw new ApiError(404, 'not_found', 'Order not found.')

    assertTransition(current.status_code, body.statusCode)

    const results = await db.transaction((tx) => [
      tx.query('UPDATE public.orders SET status_code=$1, updated_at=now() WHERE id=$2 AND status_code=$3 RETURNING id, order_number, status_code',
        [body.statusCode, id, current.status_code]),
      tx.query('INSERT INTO public.order_status_history(order_id, status_code, changed_by_auth_user_id, note) VALUES ($1,$2,$3,$4)',
        [id, body.statusCode, admin.authUserId, body.note || null]),
    ])
    // Guarding on the previous status means a concurrent change loses rather than
    // silently overwriting.
    if (!results[0]?.[0]) throw new ApiError(409, 'status_changed', 'This order changed while you were working on it. Reload and try again.')

    await recordAudit(db, {
      actorAuthUserId: admin.authUserId, action: 'order.status_changed', entityType: 'order', entityId: id,
      summary: `${current.status_code} → ${body.statusCode}`,
    })
    return ok(results[0][0])
  }
  throw new ApiError(404, 'not_found', 'Admin endpoint not found.')
}
async function createUploadIntent(request, db, authenticate, storage) {
  const actor = await requireCustomer(request, authenticate); const body = validate(uploadIntentSchema, await readJson(request)); validateUpload(body)
  if (adminOnlyPurposes.has(body.purpose) && actor.profile.role !== 'owner') throw new ApiError(403, 'owner_required', 'Management access is required for website and catalogue media.')
  if (body.orderItemId) { const owned = await db.query("SELECT oi.id FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id WHERE oi.id=$1 AND o.customer_id=$2 AND oi.artwork_status IN ('awaiting_upload','received') AND o.status_code NOT IN ('completed','cancelled')",[body.orderItemId,actor.profile.id]); if (!owned[0]) throw new ApiError(404,'not_found','Order item not found.') }
  if (body.quoteRequestId) { const owned = await db.query('SELECT id FROM public.quote_requests WHERE id=$1 AND customer_id=$2',[body.quoteRequestId,actor.profile.id]); if (!owned[0]) throw new ApiError(404,'not_found','Quote request not found.') }
  const objectKey = createObjectKey({ purpose: body.purpose, extension: body.filename.split('.').pop() }); const visibility = body.purpose === 'customer_artwork' || body.purpose === 'design_proof' ? 'private' : 'public'
  // Ask storage first. If it is unavailable, no orphan database row is created.
  const upload = await storage.createUploadUrl({ objectKey, mimeType: body.mimeType, byteSize: body.byteSize, visibility })
  const assetId = crypto.randomUUID()
  await db.transaction((transaction) => {
    const queries = [transaction.query(
      `INSERT INTO public.media_assets(id,object_key,original_filename,mime_type,byte_size,visibility,purpose,uploaded_by_auth_user_id,upload_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
      [assetId,objectKey,body.filename,body.mimeType,body.byteSize,visibility,body.purpose,actor.authUserId])]
    if (body.orderItemId) queries.push(transaction.query("INSERT INTO public.order_item_media(order_item_id,media_id,media_role) VALUES($1,$2,'artwork')", [body.orderItemId, assetId]))
    if (body.quoteRequestId) queries.push(transaction.query('INSERT INTO public.quote_request_media(quote_request_id,media_id) VALUES($1,$2)', [body.quoteRequestId, assetId]))
    return queries
  })
  return ok({ asset: { id: assetId, object_key: objectKey, upload_status: 'pending' }, upload },201)
}
async function completeUpload(request, assetId, db, authenticate, storage) {
  const actor = await requireCustomer(request, authenticate)
  const id = validate(idSchema, assetId)
  const [asset] = await db.query(
    `SELECT m.id,m.object_key,m.visibility,m.upload_status,
            (SELECT oi.id FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id WHERE oim.media_id=m.id LIMIT 1) AS order_item_id,
            EXISTS(SELECT 1 FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id JOIN public.orders o ON o.id=oi.order_id WHERE oim.media_id=m.id AND o.customer_id=$2) OR
            EXISTS(SELECT 1 FROM public.quote_request_media qrm JOIN public.quote_requests qr ON qr.id=qrm.quote_request_id WHERE qrm.media_id=m.id AND qr.customer_id=$2) AS owned
     FROM public.media_assets m WHERE m.id=$1`, [id, actor.profile.id])
  if (!asset || (actor.profile.role !== 'owner' && !asset.owned)) throw new ApiError(404, 'not_found', 'File not found.')
  if (typeof storage.verifyObject !== 'function') throw new ApiError(501, 'storage_verification_unavailable', 'The storage adapter cannot verify completed uploads.')
  await storage.verifyObject({ objectKey: asset.object_key })
  const [completed] = await db.query(
    `WITH completed AS (
       UPDATE public.media_assets SET upload_status='available'
       WHERE id=$1 AND upload_status='pending' RETURNING id,upload_status
     ), received_item AS (
       UPDATE public.order_items SET artwork_status='received'
       WHERE id=$2 AND EXISTS (SELECT 1 FROM completed) AND artwork_status='awaiting_upload'
       RETURNING id,order_id
     ), advanced_order AS (
       UPDATE public.orders o SET status_code='artwork_received',updated_at=now()
       WHERE o.id IN (SELECT order_id FROM received_item) AND o.status_code='artwork_required'
         AND NOT EXISTS (
           SELECT 1 FROM public.order_items pending
           WHERE pending.order_id=o.id AND pending.artwork_status='awaiting_upload'
             AND pending.id NOT IN (SELECT id FROM received_item)
         )
       RETURNING id
     ), history AS (
       INSERT INTO public.order_status_history(order_id,status_code,changed_by_auth_user_id,note)
       SELECT id,'artwork_received',$3,'Required artwork received' FROM advanced_order
     )
     SELECT * FROM completed`,
    [id, asset.order_item_id || null, actor.authUserId])
  return ok(completed || { id, upload_status: asset.upload_status })
}
async function removeUpload(request, assetId, db, authenticate, storage) {
  const actor = await requireCustomer(request, authenticate)
  const id = validate(idSchema, assetId)
  const [asset] = await db.query(
    `SELECT m.id,m.object_key,
            (SELECT oi.id FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id WHERE oim.media_id=m.id LIMIT 1) AS order_item_id,
            (SELECT o.status_code FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id JOIN public.orders o ON o.id=oi.order_id WHERE oim.media_id=m.id LIMIT 1) AS order_status,
            EXISTS(SELECT 1 FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id JOIN public.orders o ON o.id=oi.order_id WHERE oim.media_id=m.id AND o.customer_id=$2) OR
            EXISTS(SELECT 1 FROM public.quote_request_media qrm JOIN public.quote_requests qr ON qr.id=qrm.quote_request_id WHERE qrm.media_id=m.id AND qr.customer_id=$2) AS owned
     FROM public.media_assets m WHERE m.id=$1`, [id, actor.profile.id])
  if (!asset || (actor.profile.role !== 'owner' && !asset.owned)) throw new ApiError(404, 'not_found', 'File not found.')
  if (asset.order_item_id && !['artwork_required', 'artwork_received', 'awaiting_payment', 'new'].includes(asset.order_status)) {
    throw new ApiError(409, 'artwork_locked', 'Artwork can no longer be removed because this order has progressed.')
  }
  await storage.deleteObject({ objectKey: asset.object_key })
  await db.query(
    `WITH removed AS (
       DELETE FROM public.media_assets WHERE id=$1 RETURNING id
     ), reset_item AS (
       UPDATE public.order_items oi SET artwork_status='awaiting_upload'
       WHERE oi.id=$2 AND EXISTS (SELECT 1 FROM removed)
         AND NOT EXISTS (
           SELECT 1 FROM public.order_item_media other_link
           JOIN public.media_assets other ON other.id=other_link.media_id
           WHERE other_link.order_item_id=oi.id AND other.id<>$1 AND other.upload_status='available'
         )
       RETURNING order_id
     ), reset_order AS (
       UPDATE public.orders o SET status_code='artwork_required',updated_at=now()
       WHERE o.id IN (SELECT order_id FROM reset_item) AND o.status_code='artwork_received'
       RETURNING id
     ), history AS (
       INSERT INTO public.order_status_history(order_id,status_code,changed_by_auth_user_id,note)
       SELECT id,'artwork_required',$3,'Customer artwork removed' FROM reset_order
     )
     SELECT id FROM removed`,
    [id, asset.order_item_id || null, actor.authUserId])
  return ok({ id, removed: true })
}
async function getFileAccess(request, assetId, db, authenticate, storage) {
  const id = validate(idSchema,assetId); const asset = (await db.query("SELECT id,object_key,visibility,purpose FROM public.media_assets WHERE id=$1 AND upload_status='available'",[id]))[0]; if (!asset) throw new ApiError(404,'not_found','File not found.')
  if (asset.visibility === 'private') { const actor = await requireCustomer(request,authenticate); if (actor.profile.role !== 'owner') { const owned = await db.query('SELECT 1 FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id JOIN public.orders o ON o.id=oi.order_id WHERE oim.media_id=$1 AND o.customer_id=$2 UNION ALL SELECT 1 FROM public.quote_request_media qrm JOIN public.quote_requests qr ON qr.id=qrm.quote_request_id WHERE qrm.media_id=$1 AND qr.customer_id=$2 LIMIT 1',[id,actor.profile.id]); if (!owned[0]) throw new ApiError(404,'not_found','File not found.') } }
  const download = await storage.createDownloadUrl({ objectKey: asset.object_key, visibility: asset.visibility }); return ok({ download })
}
