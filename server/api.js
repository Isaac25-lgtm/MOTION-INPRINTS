import { ApiError, fail, json, ok, parsePaging, readJson } from './http.js'
import { requireAdmin, requireAuth, requireCustomer, requireOwnership } from './auth.js'
import { buildUpdate, categoryPatchSchema, categorySchema, contentSchema, idSchema, orderStatusSchema, productPatchSchema, productSchema, profileSchema, projectPatchSchema, projectSchema, quoteRequestSchema, quoteStatusSchema, uploadIntentSchema, validate } from './validation.js'
import { createObjectKey, validateUpload } from './storage.js'

const routes = (pathname) => pathname.replace(/^\/api/, '').split('/').filter(Boolean)
const publicProductFields = 'id, name, slug, short_description, description, category_id, pricing_type, starting_price, currency, production_lead_time'
const productColumns = { name: 'name', slug: 'slug', categoryId: 'category_id', shortDescription: 'short_description', description: 'description', pricingType: 'pricing_type', startingPrice: 'starting_price', isConfigurable: 'is_configurable', quoteRequired: 'quote_required', status: 'status' }
const categoryColumns = { name: 'name', slug: 'slug', parentId: 'parent_id', description: 'description', sortOrder: 'sort_order', isPublished: 'is_published' }
const projectColumns = { title: 'title', slug: 'slug', categoryId: 'category_id', clientName: 'client_name', location: 'location', description: 'description', completedOn: 'completed_on', isFeatured: 'is_featured', isPublished: 'is_published' }
// Public buckets are part of the published website, so only an administrator may place objects in them.
const adminOnlyPurposes = new Set(['product_image', 'project_image', 'website_asset'])

// First public image for a row, as a storage object key. The key is turned into a URL
// only if a public base URL is configured; until storage is provisioned it stays null.
const mediaKey = (linkTable, column) => `(SELECT m.object_key FROM public.${linkTable} lt JOIN public.media_assets m ON m.id = lt.media_id WHERE lt.${column} = p.id AND m.visibility = 'public' ORDER BY lt.sort_order LIMIT 1) AS image_key`

const withMediaUrl = (baseUrl) => (row) => {
  const { image_key: key, ...rest } = row
  return { ...rest, image: key && baseUrl ? `${baseUrl.replace(/\/$/, '')}/${key}` : null }
}

export function createApi({ db, authenticate = async () => null, logger = console, storage, mediaBaseUrl = null }) {
  const decorate = withMediaUrl(mediaBaseUrl)
  return async function api(request) {
    const started = Date.now(); const url = new URL(request.url); const parts = routes(url.pathname)
    try {
      let response
      if (request.method === 'GET' && parts[0] === 'products' && !parts[1]) response = ok((await listProducts(db, url)).map(decorate))
      else if (request.method === 'GET' && parts[0] === 'products' && parts[1]) { const rows = await db.query(`SELECT ${publicProductFields}, c.name AS category_name, c.slug AS category_slug, ${mediaKey('product_media', 'product_id')} FROM public.products p LEFT JOIN public.categories c ON c.id = p.category_id WHERE p.slug=$1 AND p.status='published'`, [parts[1]]); if (!rows[0]) throw new ApiError(404, 'not_found', 'Product not found.'); response = ok(decorate(rows[0])) }
      else if (request.method === 'GET' && parts[0] === 'categories' && !parts[1]) response = ok(await db.query("SELECT id,name,slug,parent_id,description,sort_order FROM public.categories WHERE is_published=true ORDER BY sort_order,name"))
      else if (request.method === 'GET' && (parts[0] === 'categories' || parts[0] === 'services') && parts[1]) { const rows = await db.query('SELECT id,name,slug,parent_id,description FROM public.categories WHERE is_published=true AND slug=$1', [parts[1]]); if (!rows[0]) throw new ApiError(404, 'not_found', 'Not found.'); response = ok(rows[0]) }
      else if (request.method === 'GET' && parts[0] === 'services') response = ok(await db.query("SELECT id,name,slug,parent_id,description,sort_order FROM public.categories WHERE is_published=true ORDER BY sort_order,name"))
      else if (request.method === 'GET' && parts[0] === 'projects' && !parts[1]) response = ok((await listProjects(db, url)).map(decorate))
      else if (request.method === 'GET' && parts[0] === 'projects' && parts[1]) { const rows = await db.query(`SELECT p.id,p.title,p.slug,p.description,p.client_name,p.location,p.completed_on,p.category_id,c.name AS category_name,c.slug AS category_slug, ${mediaKey('project_media', 'project_id')} FROM public.projects p LEFT JOIN public.categories c ON c.id = p.category_id WHERE p.is_published=true AND p.slug=$1`, [parts[1]]); if (!rows[0]) throw new ApiError(404, 'not_found', 'Project not found.'); const project = decorate(rows[0]); const gallery = await db.query("SELECT m.object_key, m.original_filename FROM public.project_media pm JOIN public.media_assets m ON m.id = pm.media_id WHERE pm.project_id=$1 AND m.visibility='public' ORDER BY pm.sort_order OFFSET 1", [project.id]); project.gallery = gallery.map(item => ({ image: mediaBaseUrl ? `${mediaBaseUrl.replace(/\/$/, '')}/${item.object_key}` : null, alt: item.original_filename })); response = ok(project) }
      else if (request.method === 'GET' && parts[0] === 'search') response = ok(await search(db, url, decorate))
      else if (request.method === 'GET' && parts[0] === 'content' && parts[1] === 'public') response = ok(await db.query("SELECT section,entry_key,value FROM public.content_entries WHERE is_published=true"))
      else if (request.method === 'GET' && parts[0] === 'me') { const actor = await requireCustomer(request, authenticate); response = ok(actor.profile) }
      else if (request.method === 'POST' && parts[0] === 'me') { const actor = await requireAuth(request, authenticate); const body = validate(profileSchema, await readJson(request)); if (actor.profile) throw new ApiError(409, 'profile_exists', 'A profile already exists.'); const rows = await db.query('INSERT INTO public.user_profiles(auth_user_id,role,full_name,phone,company_name) VALUES($1,$2,$3,$4,$5) RETURNING id,auth_user_id,role,full_name,phone,company_name', [actor.authUserId,'customer',body.fullName,body.phone || null,body.companyName || null]); response = ok(rows[0], 201) }
      else if (request.method === 'PATCH' && parts[0] === 'me') { const actor = await requireCustomer(request, authenticate); const body = validate(profileSchema, await readJson(request)); const rows = await db.query('UPDATE public.user_profiles SET full_name=$1,phone=$2,company_name=$3 WHERE id=$4 RETURNING id,auth_user_id,role,full_name,phone,company_name', [body.fullName,body.phone || null,body.companyName || null,actor.profile.id]); response = ok(rows[0]) }
      else if (request.method === 'GET' && parts[0] === 'orders' && !parts[1]) { const actor = await requireCustomer(request, authenticate); response = ok(await db.query('SELECT id,order_number,status_code,total_amount,currency,created_at FROM public.orders WHERE customer_id=$1 ORDER BY created_at DESC', [actor.profile.id])) }
      else if (request.method === 'GET' && parts[0] === 'orders' && parts[1]) { const actor = await requireCustomer(request, authenticate); const row = (await db.query('SELECT id,customer_id,order_number,status_code,total_amount,currency,created_at FROM public.orders WHERE id=$1', [validate(idSchema, parts[1])]))[0]; response = ok(requireOwnership(row, actor)) }
      else if (request.method === 'GET' && parts[0] === 'quotes') { const actor = await requireCustomer(request, authenticate); response = ok(await db.query('SELECT id,request_number,status_code,created_at FROM public.quote_requests WHERE customer_id=$1 ORDER BY created_at DESC', [actor.profile.id])) }
      else if (request.method === 'POST' && parts[0] === 'quote-requests') { const body = validate(quoteRequestSchema, await readJson(request)); const actor = await authenticate(request); const requestNumber = `QR-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`; const rows = await db.query('INSERT INTO public.quote_requests(request_number,customer_id,contact_name,contact_email,contact_phone,project_brief,status_code) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,request_number,status_code,created_at', [requestNumber, actor?.profile?.id || null, body.contactName, body.contactEmail, body.contactPhone || null, body.projectBrief, 'submitted']); response = ok(rows[0], 201) }
      else if (request.method === 'POST' && parts[0] === 'files' && parts[1] === 'upload-intent') response = await createUploadIntent(request, db, authenticate, storage)
      else if (request.method === 'GET' && parts[0] === 'files' && parts[1] && parts[2] === 'access') response = await getFileAccess(request, parts[1], db, authenticate, storage)
      else if (parts[0] === 'admin') response = await adminApi(request, parts.slice(1), db, authenticate)
      else throw new ApiError(404, 'not_found', 'Endpoint not found.')
      logger.info?.({ method: request.method, path: url.pathname, status: response.status, ms: Date.now() - started }, 'api_request')
      return response
    } catch (error) { logger.error?.({ method: request.method, path: url.pathname, code: error.code, ms: Date.now() - started }, 'api_error'); return fail(error) }
  }
}
/* Public listings support the filters the storefront actually uses: category slug
   (including a parent's children), featured, and a sort whitelist. Sort values are
   mapped through a fixed table so no request text ever reaches the SQL string. */
const productSorts = { newest: 'p.published_at DESC NULLS LAST', name: 'p.name ASC', 'price-asc': 'p.starting_price ASC NULLS LAST', 'price-desc': 'p.starting_price DESC NULLS LAST' }

async function listProducts(db, url) {
  const { limit, offset } = parsePaging(url)
  const category = url.searchParams.get('category')
  const featured = url.searchParams.get('featured') === 'true'
  const sort = productSorts[url.searchParams.get('sort')] || productSorts.newest
  const where = ["p.status='published'"]
  const values = []
  if (category) { values.push(category); where.push(`(c.slug = $${values.length} OR parent.slug = $${values.length})`) }
  if (featured) where.push('p.is_featured = true')
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
    `SELECT p.id,p.title,p.slug,p.description,p.location,p.completed_on,p.is_featured,c.name AS category_name,c.slug AS category_slug, ${mediaKey('project_media', 'project_id')}
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
  if (request.method === 'POST' && parts[0] === 'products') { const body = validate(productSchema, await readJson(request)); const rows = await db.query('INSERT INTO public.products(name,slug,category_id,short_description,description,pricing_type,starting_price,is_configurable,quote_required,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,slug,status', [body.name,body.slug,body.categoryId || null,body.shortDescription || null,body.description || null,body.pricingType,body.startingPrice ?? null,body.isConfigurable,body.quoteRequired,body.status]); return ok(rows[0], 201) }
  if (request.method === 'PATCH' && parts[0] === 'products' && parts[1]) { const body = validate(productPatchSchema, await readJson(request)); const id = validate(idSchema,parts[1]); const { assignments, values } = buildUpdate(productColumns, body); const rows = await db.query(`UPDATE public.products SET ${assignments.join(',')} WHERE id=$${values.length + 1} RETURNING id,slug,status`, [...values,id]); if (!rows[0]) throw new ApiError(404,'not_found','Product not found.'); return ok(rows[0]) }
  if (request.method === 'DELETE' && parts[0] === 'products' && parts[1]) { const rows = await db.query("UPDATE public.products SET status='archived' WHERE id=$1 RETURNING id,status", [validate(idSchema,parts[1])]); if (!rows[0]) throw new ApiError(404,'not_found','Product not found.'); return ok(rows[0]) }
  if (request.method === 'GET' && parts[0] === 'categories') return ok(await db.query('SELECT id,name,slug,parent_id,description,sort_order,is_published FROM public.categories ORDER BY sort_order,name'))
  if (request.method === 'POST' && parts[0] === 'categories') { const body = validate(categorySchema, await readJson(request)); const rows = await db.query('INSERT INTO public.categories(name,slug,parent_id,description,sort_order,is_published) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,slug', [body.name,body.slug,body.parentId || null,body.description || null,body.sortOrder,body.isPublished]); return ok(rows[0],201) }
  if (request.method === 'PATCH' && parts[0] === 'categories' && parts[1]) { const body = validate(categoryPatchSchema, await readJson(request)); const id = validate(idSchema,parts[1]); const { assignments, values } = buildUpdate(categoryColumns, body); const rows = await db.query(`UPDATE public.categories SET ${assignments.join(',')} WHERE id=$${values.length + 1} RETURNING id,slug`, [...values,id]); if (!rows[0]) throw new ApiError(404,'not_found','Category not found.'); return ok(rows[0]) }
  if (request.method === 'GET' && parts[0] === 'orders') { const { limit, offset } = parsePaging(new URL(request.url)); return ok(await db.query('SELECT id,order_number,customer_id,status_code,total_amount,currency,created_at FROM public.orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset])) }
  if (request.method === 'GET' && parts[0] === 'quotes') { const { limit, offset } = parsePaging(new URL(request.url)); return ok(await db.query('SELECT id,request_number,customer_id,status_code,contact_name,contact_email,created_at FROM public.quote_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset])) }
  if (request.method === 'PATCH' && parts[0] === 'quotes' && parts[1]) { const body = validate(quoteStatusSchema,await readJson(request)); const rows = await db.query('UPDATE public.quotes SET status_code=$1,total_amount=COALESCE($2,total_amount),valid_until=$3 WHERE id=$4 RETURNING id,status_code,total_amount', [body.statusCode,body.totalAmount ?? null,body.validUntil ?? null,validate(idSchema,parts[1])]); if (!rows[0]) throw new ApiError(404,'not_found','Quote not found.'); return ok(rows[0]) }
  if (request.method === 'POST' && parts[0] === 'projects') { const body = validate(projectSchema,await readJson(request)); const rows = await db.query('INSERT INTO public.projects(title,slug,category_id,client_name,location,description,completed_on,is_featured,is_published,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9 THEN now() ELSE NULL END) RETURNING id,slug',[body.title,body.slug,body.categoryId || null,body.clientName || null,body.location || null,body.description || null,body.completedOn || null,body.isFeatured,body.isPublished]); return ok(rows[0],201) }
  if (request.method === 'PATCH' && parts[0] === 'projects' && parts[1]) { const body = validate(projectPatchSchema,await readJson(request)); const id = validate(idSchema,parts[1]); const { assignments, values, placeholders } = buildUpdate(projectColumns, body); if (placeholders.isPublished) assignments.push(`published_at=CASE WHEN $${placeholders.isPublished} AND published_at IS NULL THEN now() WHEN NOT $${placeholders.isPublished} THEN NULL ELSE published_at END`); const rows = await db.query(`UPDATE public.projects SET ${assignments.join(',')} WHERE id=$${values.length + 1} RETURNING id,slug`,[...values,id]); if (!rows[0]) throw new ApiError(404,'not_found','Project not found.'); return ok(rows[0]) }
  // Scoped to a single entry: a section may hold several keys, and one PATCH must never overwrite them all.
  if (request.method === 'PATCH' && parts[0] === 'content' && parts[1]) { const body = validate(contentSchema,await readJson(request)); const entryKey = parts[2] || body.entryKey; const rows = await db.query('UPDATE public.content_entries SET value=$1,is_published=COALESCE($2,is_published) WHERE section=$3 AND entry_key=$4 RETURNING id,section,entry_key,value,is_published',[JSON.stringify(body.value),body.isPublished ?? null,parts[1],entryKey]); if (!rows[0]) throw new ApiError(404,'not_found','Content entry not found.'); return ok(rows[0]) }
  if (request.method === 'PATCH' && parts[0] === 'orders' && parts[1] && parts[2] === 'status') { const body = validate(orderStatusSchema, await readJson(request)); const id = validate(idSchema, parts[1]); const [rows, history] = await db.transaction((transaction) => [transaction.query('UPDATE public.orders SET status_code=$1 WHERE id=$2 RETURNING id,order_number,status_code', [body.statusCode,id]), transaction.query('INSERT INTO public.order_status_history(order_id,status_code,changed_by_auth_user_id,note) SELECT id,$1,$2,$3 FROM public.orders WHERE id=$4 RETURNING id', [body.statusCode,admin.authUserId,body.note || null,id])]); if (!rows[0] || !history[0]) throw new ApiError(404,'not_found','Order not found.'); return ok(rows[0]) }
  throw new ApiError(404, 'not_found', 'Admin endpoint not found.')
}
async function createUploadIntent(request, db, authenticate, storage) {
  const actor = await requireCustomer(request, authenticate); const body = validate(uploadIntentSchema, await readJson(request)); validateUpload(body)
  if (adminOnlyPurposes.has(body.purpose) && actor.profile.role !== 'admin') throw new ApiError(403, 'admin_required', 'Administrator access is required for website and catalogue media.')
  if (body.orderItemId) { const owned = await db.query('SELECT oi.id FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id WHERE oi.id=$1 AND o.customer_id=$2',[body.orderItemId,actor.profile.id]); if (!owned[0]) throw new ApiError(404,'not_found','Order item not found.') }
  if (body.quoteRequestId) { const owned = await db.query('SELECT id FROM public.quote_requests WHERE id=$1 AND customer_id=$2',[body.quoteRequestId,actor.profile.id]); if (!owned[0]) throw new ApiError(404,'not_found','Quote request not found.') }
  const objectKey = createObjectKey({ purpose: body.purpose, extension: body.filename.split('.').pop() }); const visibility = body.purpose === 'customer_artwork' || body.purpose === 'design_proof' ? 'private' : 'public'
  const [asset] = await db.query('INSERT INTO public.media_assets(object_key,original_filename,mime_type,byte_size,visibility,purpose,uploaded_by_auth_user_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,object_key',[objectKey,body.filename,body.mimeType,body.byteSize,visibility,body.purpose,actor.authUserId])
  const upload = await storage.createUploadUrl({ objectKey, mimeType: body.mimeType, byteSize: body.byteSize, visibility }); return ok({ asset, upload },201)
}
async function getFileAccess(request, assetId, db, authenticate, storage) {
  const id = validate(idSchema,assetId); const asset = (await db.query('SELECT id,object_key,visibility,purpose FROM public.media_assets WHERE id=$1',[id]))[0]; if (!asset) throw new ApiError(404,'not_found','File not found.')
  if (asset.visibility === 'private') { const actor = await requireCustomer(request,authenticate); if (actor.profile.role !== 'admin') { const owned = await db.query('SELECT 1 FROM public.order_item_media oim JOIN public.order_items oi ON oi.id=oim.order_item_id JOIN public.orders o ON o.id=oi.order_id WHERE oim.media_id=$1 AND o.customer_id=$2 UNION ALL SELECT 1 FROM public.quote_request_media qrm JOIN public.quote_requests qr ON qr.id=qrm.quote_request_id WHERE qrm.media_id=$1 AND qr.customer_id=$2 LIMIT 1',[id,actor.profile.id]); if (!owned[0]) throw new ApiError(404,'not_found','File not found.') } }
  const download = await storage.createDownloadUrl({ objectKey: asset.object_key, visibility: asset.visibility }); return ok({ download })
}
