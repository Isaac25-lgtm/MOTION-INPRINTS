import { CURRENCY, toAmount, toWire } from './money.js'

/* Business reports (Prompt 10.6).

   Every figure is computed in SQL, not by pulling rows into JavaScript, so a
   report stays fast as the order table grows.

   The accounting rules, stated once and applied everywhere:

   - Revenue counts **settled payments only**. An order that is placed but unpaid
     is not revenue, and a cancelled order never is.
   - Outstanding means an active, uncancelled order with no successful payment.
   - Quote conversion uses an explicit denominator: quotes actually SENT to a
     customer. Draft and unsent quotes are excluded, because including them would
     make the rate depend on internal admin activity rather than customer decisions.

   Where Motion has no activity yet, these return zero — never a seeded figure. */

export const METRIC_DEFINITIONS = {
  revenue: 'Sum of payments with status "successful" in the period. Placed-but-unpaid orders are excluded.',
  orderCount: 'Orders created in the period, excluding cancelled.',
  averageOrderValue: 'Total value of non-cancelled orders in the period ÷ number of those orders.',
  outstanding: 'Total of non-cancelled, non-completed orders that have no successful payment.',
  quoteConversion: 'Accepted quotes ÷ quotes sent to a customer, both counted by send date in the period.',
  averageProductionTime: 'Mean hours from order creation to the first "completed" status entry, for orders completed in the period.',
  repeatCustomers: 'Guest contacts with more than one non-cancelled order, counted over all time by contact_id.',
}

/** Resolves a named range into explicit bounds, so every query uses the same window. */
export function resolveRange(range = 'this_month', from = null, to = null) {
  const now = new Date()
  const startOfDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  switch (range) {
    case 'today': return { from: startOfDay(now), to: now, label: 'Today' }
    case 'this_week': {
      const start = startOfDay(now)
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
      return { from: start, to: now, label: 'This week' }
    }
    case 'last_month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      return { from: start, to: end, label: 'Last month' }
    }
    case 'custom': {
      const start = from ? new Date(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const end = to ? new Date(to) : now
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new RangeError('Invalid date range.')
      return { from: start, to: end, label: 'Custom range' }
    }
    default: return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now, label: 'This month' }
  }
}

export async function buildReport(db, { range, from, to }) {
  const window = resolveRange(range, from, to)
  const bounds = [window.from.toISOString(), window.to.toISOString()]

  const [summary, byStatus, monthly, byCategory, topProducts, quotes, outstanding, production, repeat] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM public.payments
           WHERE status='successful' AND created_at >= $1 AND created_at < $2) AS revenue,
         (SELECT COUNT(*) FROM public.orders
           WHERE status_code <> 'cancelled' AND created_at >= $1 AND created_at < $2) AS orders,
         (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders
           WHERE status_code <> 'cancelled' AND created_at >= $1 AND created_at < $2) AS order_value`, bounds),

    db.query(
      `SELECT status_code, COUNT(*)::int AS count FROM public.orders
       WHERE created_at >= $1 AND created_at < $2 GROUP BY status_code ORDER BY count DESC`, bounds),

    // Twelve months of settled revenue, for the one chart that earns its place.
    db.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COALESCE(SUM(amount), 0) AS revenue, COUNT(*)::int AS payments
       FROM public.payments WHERE status='successful' AND created_at >= now() - interval '12 months'
       GROUP BY 1 ORDER BY 1`),

    db.query(
      `SELECT COALESCE(c.name, 'Uncategorised') AS category, COALESCE(SUM(oi.line_total), 0) AS revenue, COUNT(DISTINCT o.id)::int AS orders
       FROM public.order_items oi
       JOIN public.orders o ON o.id = oi.order_id
       LEFT JOIN public.products p ON p.id = oi.product_id
       LEFT JOIN public.categories c ON c.id = p.category_id
       WHERE o.status_code <> 'cancelled' AND o.created_at >= $1 AND o.created_at < $2
       GROUP BY 1 ORDER BY revenue DESC LIMIT 10`, bounds),

    db.query(
      `SELECT oi.title, COALESCE(SUM(oi.quantity), 0)::int AS units, COALESCE(SUM(oi.line_total), 0) AS revenue
       FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
       WHERE o.status_code <> 'cancelled' AND o.created_at >= $1 AND o.created_at < $2
       GROUP BY oi.title ORDER BY revenue DESC LIMIT 10`, bounds),

    db.query(
      `SELECT
         (SELECT COUNT(*) FROM public.quote_requests WHERE created_at >= $1 AND created_at < $2) AS requests,
         (SELECT COUNT(*) FROM public.quotes WHERE sent_at IS NOT NULL AND sent_at >= $1 AND sent_at < $2) AS sent,
         (SELECT COUNT(*) FROM public.quotes WHERE customer_accepted_at IS NOT NULL AND sent_at >= $1 AND sent_at < $2) AS accepted`, bounds),

    db.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) AS amount, COUNT(*)::int AS orders
       FROM public.orders o
       WHERE o.status_code NOT IN ('cancelled', 'completed')
         AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.status = 'successful')`),

    db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (h.created_at - o.created_at)) / 3600.0) AS hours, COUNT(*)::int AS completed
       FROM public.orders o
       JOIN LATERAL (SELECT created_at FROM public.order_status_history
                     WHERE order_id = o.id AND status_code = 'completed' ORDER BY created_at LIMIT 1) h ON true
       WHERE h.created_at >= $1 AND h.created_at < $2`, bounds),

    db.query(
      `SELECT COUNT(*)::int AS repeat_customers FROM (
         SELECT contact_id FROM public.orders
         WHERE contact_id IS NOT NULL AND status_code <> 'cancelled'
         GROUP BY contact_id HAVING COUNT(*) > 1) repeats`),
  ])

  const totals = summary[0] || {}
  const orderCount = Number(totals.orders || 0)
  const orderValue = toAmount(totals.order_value) || 0
  const quoteStats = quotes[0] || {}
  const sent = Number(quoteStats.sent || 0)
  const accepted = Number(quoteStats.accepted || 0)

  return {
    range: { from: window.from.toISOString(), to: window.to.toISOString(), label: window.label },
    currency: CURRENCY,
    definitions: METRIC_DEFINITIONS,
    summary: {
      revenue: toWire(toAmount(totals.revenue) || 0),
      orders: orderCount,
      orderValue: toWire(orderValue),
      // Undefined rather than zero when there are no orders — an average of
      // nothing is not zero, and showing zero would misrepresent it.
      averageOrderValue: orderCount ? toWire(Math.round(orderValue / orderCount)) : null,
      outstanding: toWire(toAmount(outstanding[0]?.amount) || 0),
      outstandingOrders: Number(outstanding[0]?.orders || 0),
      quoteRequests: Number(quoteStats.requests || 0),
      quotesSent: sent,
      quotesAccepted: accepted,
      quoteConversion: sent ? Math.round((accepted / sent) * 1000) / 10 : null,
      averageProductionHours: production[0]?.hours ? Math.round(Number(production[0].hours) * 10) / 10 : null,
      completedInPeriod: Number(production[0]?.completed || 0),
      repeatCustomers: Number(repeat[0]?.repeat_customers || 0),
    },
    ordersByStatus: byStatus,
    monthlyRevenue: monthly.map(row => ({ month: row.month, revenue: toWire(toAmount(row.revenue) || 0), payments: row.payments })),
    salesByCategory: byCategory.map(row => ({ category: row.category, revenue: toWire(toAmount(row.revenue) || 0), orders: row.orders })),
    topProducts: topProducts.map(row => ({ title: row.title, units: row.units, revenue: toWire(toAmount(row.revenue) || 0) })),
  }
}

/** Operational counts for the admin dashboard (Prompt 10.1). */
export async function operationalSnapshot(db) {
  const [counts, attention, activity] = await Promise.all([
    db.query(
      `SELECT status_code, COUNT(*)::int AS count FROM public.orders
       WHERE status_code NOT IN ('completed','cancelled') GROUP BY status_code`),
    db.query(
      `SELECT o.id, o.order_number, o.status_code, o.contact_name, o.total_amount, o.currency, o.created_at,
              CASE
                WHEN o.status_code='artwork_required' THEN 'Artwork missing'
                WHEN o.status_code='awaiting_customer_approval' THEN 'Waiting on customer approval'
                WHEN o.status_code='awaiting_payment' THEN 'Payment outstanding'
                WHEN o.status_code='ready' THEN 'Ready and awaiting collection'
                ELSE 'Needs review'
              END AS reason
       FROM public.orders o
       WHERE o.status_code IN ('artwork_required','awaiting_customer_approval','awaiting_payment','ready')
       ORDER BY o.created_at ASC LIMIT 25`),
    db.query(
      `SELECT 'order' AS kind, id, order_number AS reference, contact_name AS who, status_code AS detail, created_at
       FROM public.orders ORDER BY created_at DESC LIMIT 8`),
  ])

  const openQuotes = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM public.quote_requests WHERE status_code='submitted') AS new_requests,
       (SELECT COUNT(*) FROM public.quotes WHERE status_code='sent' AND customer_accepted_at IS NULL AND superseded_at IS NULL) AS awaiting_customer`)

  const byStatus = Object.fromEntries(counts.map(row => [row.status_code, row.count]))
  return {
    counts: {
      new: byStatus.new || 0,
      awaitingPayment: byStatus.awaiting_payment || 0,
      artworkRequired: byStatus.artwork_required || 0,
      awaitingApproval: byStatus.awaiting_customer_approval || 0,
      inProduction: byStatus.in_production || 0,
      ready: byStatus.ready || 0,
      newQuoteRequests: Number(openQuotes[0]?.new_requests || 0),
      quotesAwaitingCustomer: Number(openQuotes[0]?.awaiting_customer || 0),
    },
    needsAttention: attention.map(row => ({
      id: row.id, reference: row.order_number, status: row.status_code, reason: row.reason,
      customer: row.contact_name, total: toWire(toAmount(row.total_amount)), currency: row.currency, createdAt: row.created_at,
    })),
    recentActivity: activity,
  }
}
