import { z } from 'zod'
import { ApiError } from './http.js'
export const idSchema = z.string().uuid()
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const quoteRequestSchema = z.object({ contactName: z.string().trim().min(2).max(120), contactEmail: z.string().trim().email().max(254), contactPhone: z.string().trim().max(40).optional(), projectBrief: z.string().trim().min(10).max(10000) })
export const profileSchema = z.object({ fullName: z.string().trim().min(2).max(160), phone: z.string().trim().max(40).optional(), companyName: z.string().trim().max(160).optional() })

// Pricing kind and quote_required must always agree; the same rule is enforced by a CHECK constraint in migration 0001.
const pricingAgrees = (value, context) => {
  if (value.pricingType === 'fixed' && 'startingPrice' in value && value.startingPrice == null) context.addIssue({ code: 'custom', path: ['startingPrice'], message: 'Fixed-price products require a starting price.' })
  if (value.pricingType !== undefined && value.quoteRequired !== undefined && (value.pricingType === 'quote_only') !== value.quoteRequired) context.addIssue({ code: 'custom', path: ['quoteRequired'], message: 'quoteRequired must match quote_only pricing.' })
}
// Bases carry no `.default()`: Zod keeps defaults through `.partial()`, so a base default would silently
// reset an unmentioned column on every PATCH. Defaults belong to the create schemas only.
const productBase = z.object({ name: z.string().trim().min(2).max(180), slug, categoryId: idSchema.nullable().optional(), shortDescription: z.string().trim().max(300).nullable().optional(), description: z.string().trim().max(30000).nullable().optional(), pricingType: z.enum(['fixed','configurable','quote_only']), startingPrice: z.coerce.number().nonnegative().nullable().optional(), isConfigurable: z.boolean(), quoteRequired: z.boolean(), status: z.enum(['draft','published','archived']) })
export const productSchema = productBase.extend({ isConfigurable: z.boolean().default(false), status: z.enum(['draft','published','archived']).default('draft') }).superRefine((value, context) => { if (value.pricingType === 'fixed' && value.startingPrice == null) context.addIssue({ code: 'custom', path: ['startingPrice'], message: 'Fixed-price products require a starting price.' }); pricingAgrees(value, context) })
export const productPatchSchema = productBase.partial().superRefine(pricingAgrees)

export const orderStatusSchema = z.object({ statusCode: z.string().regex(/^[a-z_]+$/), note: z.string().trim().max(2000).optional() })
const categoryBase = z.object({ name: z.string().trim().min(2).max(120), slug, parentId: idSchema.nullable().optional(), description: z.string().trim().max(3000).nullable().optional(), sortOrder: z.coerce.number().int().nonnegative(), isPublished: z.boolean() })
export const categorySchema = categoryBase.extend({ sortOrder: z.coerce.number().int().nonnegative().default(0), isPublished: z.boolean().default(false) })
export const categoryPatchSchema = categoryBase.partial()
const projectBase = z.object({ title: z.string().trim().min(2).max(180), slug, categoryId: idSchema.nullable().optional(), clientName: z.string().trim().max(180).nullable().optional(), location: z.string().trim().max(180).nullable().optional(), description: z.string().trim().max(30000).nullable().optional(), completedOn: z.string().date().nullable().optional(), isFeatured: z.boolean(), isPublished: z.boolean() })
export const projectSchema = projectBase.extend({ isFeatured: z.boolean().default(false), isPublished: z.boolean().default(false) })
export const projectPatchSchema = projectBase.partial()
/* Content is editable; presentation is not. The owner sets values, publication
   state and an optional schedule — never fonts, colours, spacing or layout. */
export const contentSchema = z.object({
  entryKey: z.string().trim().min(1).max(120).default('default'),
  value: z.record(z.string(), z.unknown()).optional(),
  isPublished: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  publishFrom: z.string().datetime({ offset: true }).nullish(),
  publishUntil: z.string().datetime({ offset: true }).nullish(),
}).superRefine((value, context) => {
  const hasChange = ['value', 'isPublished', 'status', 'publishFrom', 'publishUntil']
    .some(field => Object.prototype.hasOwnProperty.call(value, field))
  if (!hasChange) context.addIssue({ code: 'custom', message: 'Provide content or a publication change.' })
  if (value.status && value.isPublished !== undefined && value.isPublished !== (value.status === 'published')) {
    context.addIssue({ code: 'custom', path: ['isPublished'], message: 'isPublished must agree with status.' })
  }
  if (value.status === 'scheduled' && !value.publishFrom) {
    context.addIssue({ code: 'custom', path: ['publishFrom'], message: 'A scheduled entry needs a start time.' })
  }
  if (value.publishFrom && value.publishUntil && new Date(value.publishUntil) <= new Date(value.publishFrom)) {
    context.addIssue({ code: 'custom', path: ['publishUntil'], message: 'The end must come after the start.' })
  }
})
export const quoteStatusSchema = z.object({ statusCode: z.string().regex(/^[a-z_]+$/), totalAmount: z.coerce.number().nonnegative().optional(), validUntil: z.string().date().nullable().optional() })

/* Staff-prepared quote. Line prices come from here because a quotation is a human
   judgement about a bespoke job — but only an administrator can reach this schema. */
export const quotePrepareSchema = z.object({
  quoteRequestId: idSchema,
  supersedes: idSchema.nullish(),
  items: z.array(z.object({
    productId: idSchema.nullish(),
    title: z.string().trim().min(2).max(300),
    quantity: z.coerce.number().int().positive().max(1_000_000),
    unitPrice: z.coerce.number().int().nonnegative(),
    configuration: z.record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean()])).default({}),
  })).min(1).max(100),
  // Null means no tax applies. Nothing is assumed about VAT registration.
  taxRateBp: z.coerce.number().int().min(0).max(10000).nullish(),
  validUntil: z.string().date().nullish(),
  notes: z.string().trim().max(4000).nullish(),
  productionAssumptions: z.string().trim().max(4000).nullish(),
  paymentTerms: z.string().trim().max(2000).nullish(),
})
export const uploadIntentSchema = z.object({ filename: z.string().trim().min(1).max(255), mimeType: z.string().trim().max(120), byteSize: z.coerce.number().int().positive(), purpose: z.enum(['product_image','project_image','customer_artwork','design_proof','website_asset']), orderItemId: idSchema.optional(), quoteRequestId: idSchema.optional() }).superRefine((value, context) => {
  if (value.orderItemId && value.quoteRequestId) context.addIssue({ code: 'custom', message: 'Attach a file to either an order item or a quote request, not both.' })
  if (value.purpose === 'customer_artwork' && !value.orderItemId && !value.quoteRequestId) {
    context.addIssue({ code: 'custom', path: ['orderItemId'], message: 'Customer artwork must belong to an order item or quote request.' })
  }
})
/* A configuration is a flat map of option code to chosen value. Money keys are
   deliberately not part of the shape: a browser cannot state a price. */
const selectionSchema = z.record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean()])).default({})
const quantitySchema = z.coerce.number().int().positive().max(1_000_000)

export const pricingRequestSchema = z.object({
  productId: idSchema.optional(),
  slug: z.string().trim().max(200).optional(),
  quantity: quantitySchema,
  selection: selectionSchema,
}).refine(value => value.productId || value.slug, { message: 'Provide a product.', path: ['productId'] })

export const cartSchema = z.object({
  items: z.array(z.object({
    key: z.string().max(120).optional(),
    productId: idSchema,
    quantity: quantitySchema,
    selection: selectionSchema,
    // Accepted only so the server can report that it disagrees; never trusted.
    total: z.union([z.string(), z.number()]).nullish(),
  })).max(50),
})

/* Checkout carries no money at all: products, quantities, options and where the
   order is going. Any price the browser knows is display state, not input. */
export const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: idSchema,
    quantity: quantitySchema,
    selection: selectionSchema,
    artworkAction: z.enum(['upload_later', 'not_required']).optional(),
  })).min(1).max(50),
  contact: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(6).max(40),
    company: z.string().trim().max(160).optional(),
  }),
  fulfilment: z.object({
    method: z.enum(['collection', 'delivery']),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
}).superRefine((value, context) => {
  if (value.fulfilment.method === 'delivery' && !value.fulfilment.address?.trim()) {
    context.addIssue({ code: 'custom', path: ['fulfilment', 'address'], message: 'Enter where the order should be delivered.' })
  }
})

export const quoteResponseSchema = z.object({
  action: z.enum(['accept', 'decline', 'request_changes']),
  message: z.string().trim().min(2).max(4000).optional(),
  token: z.string().trim().max(200).optional(),
}).superRefine((value, context) => {
  if (value.action === 'request_changes' && !value.message) {
    context.addIssue({ code: 'custom', path: ['message'], message: 'Tell us what you would like changed.' })
  }
})

/* Project intake (Prompt 6.1). Answers vary by project type, so they are validated
   as a bounded document rather than a fixed set of columns. */
export const projectIntakeSchema = z.object({
  projectType: z.enum(['signage', 'printing', 'branding', 'apparel', 'promotional', 'decor', 'website', 'ecommerce', 'pos', 'other']),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().max(40).optional(),
  projectBrief: z.string().trim().min(10).max(10000),
  preferredContact: z.enum(['phone', 'whatsapp', 'email']).optional(),
  desiredTimeline: z.string().trim().max(200).optional(),
  answers: z.record(z.string().max(64), z.union([z.string().max(2000), z.number(), z.boolean()])).default({}),
})

export function validate(schema, value) { const parsed = schema.safeParse(value); if (!parsed.success) throw new ApiError(422, 'validation_failed', 'One or more values are invalid.', parsed.error.flatten().fieldErrors); return parsed.data }

// Builds a partial UPDATE from an allow-listed field-to-column map. Column names never come from request data.
export function buildUpdate(columns, body) {
  const assignments = []; const values = []; const placeholders = {}
  for (const [field, column] of Object.entries(columns)) {
    if (!(field in body)) continue
    values.push(body[field] === undefined ? null : body[field])
    placeholders[field] = values.length
    assignments.push(`${column}=$${values.length}`)
  }
  if (!assignments.length) throw new ApiError(422, 'empty_update', 'Provide at least one field to update.')
  return { assignments, values, placeholders }
}
