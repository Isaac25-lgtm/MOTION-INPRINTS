export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function present(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

/**
 * Upserts a guest contact by normalized email. Snapshots on the order or quote
 * request stay as they were submitted; this row is operational contact only.
 */
export async function upsertCustomerContact(db, { name, email, phone, company }) {
  const original = String(email || '').trim()
  const normalized = normalizeEmail(original)
  if (!normalized) return null
  const displayName = present(name) || original
  const rows = await db.query(
    `INSERT INTO public.customer_contacts(display_name, original_email, normalized_email, phone, company_name, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (normalized_email) DO UPDATE
       SET display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.customer_contacts.display_name),
           phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.customer_contacts.phone),
           company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), public.customer_contacts.company_name),
           last_seen_at = now(),
           updated_at = now()
     RETURNING id`,
    [displayName, original, normalized, present(phone), present(company)],
  )
  return rows[0]?.id || null
}
