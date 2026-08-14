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
export const contentSchema = z.object({ entryKey: z.string().trim().min(1).max(120).default('default'), value: z.record(z.string(), z.unknown()), isPublished: z.boolean().optional() })
export const quoteStatusSchema = z.object({ statusCode: z.string().regex(/^[a-z_]+$/), totalAmount: z.coerce.number().nonnegative().optional(), validUntil: z.string().date().nullable().optional() })
export const uploadIntentSchema = z.object({ filename: z.string().trim().min(1).max(255), mimeType: z.string().trim().max(120), byteSize: z.coerce.number().int().positive(), purpose: z.enum(['product_image','project_image','customer_artwork','design_proof','website_asset']), orderItemId: idSchema.optional(), quoteRequestId: idSchema.optional() })
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
