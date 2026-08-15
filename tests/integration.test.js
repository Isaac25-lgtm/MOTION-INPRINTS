import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { createApi } from '../server/api.js'
import { PAYMENT_STATUS, verifyAndSettle } from '../server/payments.js'
import { hashToken } from '../server/quotes.js'

/* Integration tests against a real PostgreSQL.
 *
 * Everything else in this suite uses in-process doubles, which can prove the
 * application's logic but not that a trigger fires, a partial index bites, or a
 * CHECK constraint rejects what it should. These run the actual SQL.
 *
 * Skipped automatically when DATABASE_URL is unset, so CI without a database
 * stays green:
 *     node --env-file=.env node_modules/vitest/vitest.mjs run tests/integration.test.js
 */

const url = process.env.DATABASE_URL
const describeIfDb = url ? describe : describe.skip

describeIfDb('schema behaviour (real database)', () => {
  let client

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : false })
    await client.connect()
  })

  afterAll(async () => { await client?.end() })

  // Each test runs in a transaction that is rolled back, so the database is left
  // exactly as it was found.
  const inRollback = async (work) => {
    await client.query('BEGIN')
    try { await work() } finally { await client.query('ROLLBACK') }
  }

  let apiTransaction = 0
  const realDatabase = () => {
    let databaseQueue = Promise.resolve()
    const enqueue = (operation) => {
      const queued = databaseQueue.then(operation)
      databaseQueue = queued.catch(() => {})
      return queued
    }
    return {
      // A production pool allows concurrent reads. This integration adapter uses
      // one Client, so serialize them to model the result without relying on pg's
      // deprecated concurrent Client.query behaviour.
      query: (statement, parameters = []) => enqueue(async () => (await client.query(statement, parameters)).rows),
      transaction: (build) => enqueue(async () => {
      const savepointName = `api_tx_${apiTransaction += 1}`
      await client.query(`SAVEPOINT ${savepointName}`)
      // Neon accepts a non-interactive transaction batch. Queue the equivalent
      // pg calls so PostgreSQL integration tests do not execute two statements on
      // one Client concurrently (deprecated in pg 8 and removed in pg 9).
      let queue = Promise.resolve()
      const operations = build({ query: (statement, parameters = []) => {
        const operation = queue.then(async () => (await client.query(statement, parameters)).rows)
        queue = operation.catch(() => {})
        return operation
      } })
      const settled = await Promise.allSettled(operations)
      const failure = settled.find(result => result.status === 'rejected')
      if (failure) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)
        await client.query(`RELEASE SAVEPOINT ${savepointName}`)
        throw failure.reason
      }
      await client.query(`RELEASE SAVEPOINT ${savepointName}`)
      return settled.map(result => result.value)
      }),
    }
  }

  const apiJson = async (response) => ({ status: response.status, ...(await response.json()) })

  /* Postgres aborts the whole transaction on any error, so an expected failure
     would poison every assertion after it. Each one runs inside a savepoint that
     is rolled back, leaving the outer transaction usable. */
  let savepoint = 0
  const expectRejection = async (work, pattern) => {
    const name = `sp_${savepoint += 1}`
    await client.query(`SAVEPOINT ${name}`)
    let error = null
    try { await work() } catch (caught) { error = caught }
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`)
    expect(error, 'expected the statement to be rejected').not.toBeNull()
    expect(error.message).toMatch(pattern)
  }

  const newRequest = async () => {
    const { rows } = await client.query(
      `INSERT INTO public.quote_requests(request_number, contact_name, contact_email, project_brief, status_code)
       VALUES ($1,'Ada','ada@example.test','A brief long enough to pass validation.','submitted') RETURNING id`,
      [`MOT-Q-${Math.random().toString(36).slice(2, 8).toUpperCase()}`])
    return rows[0].id
  }

  const newQuote = async (requestId, overrides = {}) => {
    const { rows } = await client.query(
      `INSERT INTO public.quotes(quote_number, quote_request_id, status_code, subtotal, total_amount, version)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [`MOT-QT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, requestId,
        overrides.status || 'sent', overrides.subtotal ?? 500000, overrides.total ?? 500000, overrides.version ?? 1])
    return rows[0]
  }

  it('applied every migration and recorded it', async () => {
    const { rows } = await client.query('SELECT filename FROM public.schema_migrations ORDER BY filename')
    expect(rows.map(r => r.filename)).toEqual([
      '0001_motion_core.sql', '0002_initial_taxonomy.sql', '0003_pricing_components.sql',
      '0004_quotes_and_orders.sql', '0005_portfolio_and_cms.sql', '0006_quote_status_vocabulary.sql',
      '0007_accepted_quote_immutability.sql', '0008_quote_access_and_lifecycle.sql',
      '0009_catalogue_relationships_and_uploads.sql', '0010_proofs_tracking_and_audit.sql', '0011_proof_evidence_integrity.sql', '0012_proof_supersession_invariant.sql',
    ])
  })

  /* ── Category 9/10 guarantees, verified against real PostgreSQL ─────────── */

  const newOrder = async (columns = '', values = [], status = 'new') => {
    const { rows } = await client.query(
      `INSERT INTO public.orders(order_number, contact_name, contact_email, status_code, subtotal, total_amount${columns})
       VALUES ($1,'Ada','ada@example.test',$2,1000,1000${values.map((_, i) => `,$${i + 3}`).join('')})
       RETURNING id, order_number`,
      [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, status, ...values])
    return rows[0]
  }

  /* Every public endpoint, executed against real PostgreSQL.
   *
   * The doubles used elsewhere return canned rows without parsing the SQL, so a
   * malformed statement passes them happily. `/products` and `/search` were both
   * returning 500 in the running application — `column reference "id" is
   * ambiguous`, because the shared column list was unqualified while every query
   * using it joins `categories`, which has its own id, name, slug and
   * description. Nothing but real execution catches that. */
  it('executes every public endpoint against real SQL', async () => {
    const api = createApi({ db: realDatabase(), logger: { info() {}, error() {} } })
    const endpoints = [
      '/api/products', '/api/products?category=signage', '/api/products?sort=price-asc',
      '/api/products?sort=featured&q=banner', '/api/categories', '/api/services',
      '/api/projects', '/api/projects?featured=true', '/api/content/public',
      '/api/search?q=sign', '/api/search?q=100%25',
    ]
    for (const path of endpoints) {
      const response = await api(new Request(`https://api.motion.test${path}`))
      const body = await response.json()
      expect(response.status, `${path} returned ${response.status}: ${JSON.stringify(body.error || {})}`).toBe(200)
    }
  })

  it('executes pricing and cart validation against real SQL', async () => {
    await inRollback(async () => {
      const { rows: [product] } = await client.query(
        `INSERT INTO public.products(name, slug, pricing_type, starting_price, quote_required, status, min_quantity)
         VALUES('Test banner','test-banner-sql','fixed',120000,false,'published',1) RETURNING id, slug`)
      const api = createApi({ db: realDatabase(), logger: { info() {}, error() {} } })

      const priced = await api(new Request('https://api.motion.test/api/pricing/calculate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, quantity: 3, selection: {} }),
      }))
      const pricedBody = await priced.json()
      expect(priced.status, JSON.stringify(pricedBody.error || {})).toBe(200)
      expect(pricedBody.data.total).toBe('360000')

      const cart = await api(new Request('https://api.motion.test/api/cart/validate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [{ key: 'a', productId: product.id, quantity: 2, selection: {}, total: '1' }] }),
      }))
      const cartBody = await cart.json()
      expect(cart.status, JSON.stringify(cartBody.error || {})).toBe(200)
      // The claimed total of 1 is discarded and the real price returned.
      expect(cartBody.data.items[0].total).toBe('240000')
      expect(cartBody.data.items[0].priceChanged).toBe(true)

      const detail = await api(new Request(`https://api.motion.test/api/products/${product.slug}`))
      expect(detail.status).toBe(200)
    })
  })

  it('refuses production entry without an approved proof', async () => {
    await inRollback(async () => {
      const order = await newOrder(', requires_proof_approval', [true], 'design_in_progress')
      // The guard lives in the database, so no route, script or bulk action can
      // bypass it — including one written later that forgets to check.
      await expectRejection(
        () => client.query("UPDATE public.orders SET status_code='in_production' WHERE id=$1", [order.id]),
        /requires a customer-approved proof/i)
      // Sending the job out for approval is still permitted.
      await expect(client.query("UPDATE public.orders SET status_code='awaiting_customer_approval' WHERE id=$1", [order.id])).resolves.toBeTruthy()
    })
  })

  it('permits only one proof awaiting a response per order', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const { rows: [first] } = await client.query(
        "INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,1,'awaiting_response') RETURNING id", [order.id])
      await expectRejection(
        () => client.query("INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,2,'awaiting_response')", [order.id]),
        /design_proofs_one_active|duplicate key/i)
      // A revision is allowed once the previous version is superseded.
      await client.query("UPDATE public.design_proofs SET status='superseded', superseded_at=now() WHERE id=$1", [first.id])
      await expect(client.query("INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,2,'awaiting_response')", [order.id])).resolves.toBeTruthy()
    })
  })

  it('treats an answered proof as evidence that cannot be rewritten', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const { rows: [proof] } = await client.query(
        "INSERT INTO public.design_proofs(order_id, version, status, customer_response_at, customer_comment) VALUES($1,1,'approved',now(),'Approved') RETURNING id",
        [order.id])
      await expectRejection(() => client.query("UPDATE public.design_proofs SET customer_comment='rewritten' WHERE id=$1", [proof.id]), /has been answered/i)
      await expectRejection(() => client.query('UPDATE public.design_proofs SET version=9 WHERE id=$1', [proof.id]), /has been answered/i)
      // Superseding remains possible: that records history rather than altering it.
      await expect(client.query("UPDATE public.design_proofs SET status='superseded', superseded_at=now() WHERE id=$1", [proof.id])).resolves.toBeTruthy()
    })
  })

  /* Proof evidence integrity (migration 0011).
     Two defects were reproducible before it: an answered proof could be deleted,
     and a proof belonging to another order could satisfy the production gate. */

  const someMedia = async () => {
    const { rows } = await client.query(
      `INSERT INTO public.media_assets(object_key, original_filename, mime_type, byte_size, visibility, purpose)
       VALUES ($1,'proof.pdf','application/pdf',1024,'private','design_proof') RETURNING id`,
      [`design_proof/${Math.random().toString(36).slice(2)}.pdf`])
    return rows[0].id
  }

  const answeredProof = async (orderId, version = 1, status = 'approved') => {
    const { rows } = await client.query(
      `INSERT INTO public.design_proofs(order_id, version, status, customer_response_at, customer_comment)
       VALUES($1,$2,$3,now(),'Approved') RETURNING id`, [orderId, version, status])
    return rows[0].id
  }

  it('refuses to delete a proof the customer has answered', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const proof = await answeredProof(order.id)
      await expectRejection(() => client.query('DELETE FROM public.design_proofs WHERE id=$1', [proof]), /cannot be deleted/i)
      // An unanswered proof is not evidence and may still be withdrawn.
      const { rows: [draft] } = await client.query(
        "INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,2,'awaiting_response') RETURNING id", [order.id])
      await expect(client.query('DELETE FROM public.design_proofs WHERE id=$1', [draft.id])).resolves.toBeTruthy()
    })
  })

  it('freezes every evidentiary field once a proof is answered', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const other = await newOrder('', [], 'design_in_progress')
      const proof = await answeredProof(order.id)

      const forbidden = [
        ['order_id', 'UPDATE public.design_proofs SET order_id=$2 WHERE id=$1', [proof, other.id]],
        ['version', 'UPDATE public.design_proofs SET version=9 WHERE id=$1', [proof]],
        // Setting an already-null column to null is not a change, so the probe
        // uses a real asset id to make it an actual rewrite of the file.
        ['media_id', 'UPDATE public.design_proofs SET media_id=$2 WHERE id=$1', [proof, await someMedia()]],
        ['motion_notes', "UPDATE public.design_proofs SET motion_notes='rewritten' WHERE id=$1", [proof]],
        ['uploader', 'UPDATE public.design_proofs SET uploaded_by_auth_user_id=gen_random_uuid() WHERE id=$1', [proof]],
        // Both were written with now() inside this same transaction, and now() is
        // fixed for its duration — so re-setting them to now() would change
        // nothing. The probes shift the value to make it a real rewrite.
        ['created_at', "UPDATE public.design_proofs SET created_at = now() - interval '1 day' WHERE id=$1", [proof]],
        ['response_at', "UPDATE public.design_proofs SET customer_response_at = now() + interval '1 day' WHERE id=$1", [proof]],
        ['comment', "UPDATE public.design_proofs SET customer_comment='different' WHERE id=$1", [proof]],
        ['status back to open', "UPDATE public.design_proofs SET status='awaiting_response' WHERE id=$1", [proof]],
      ]
      for (const [label, sql, params] of forbidden) {
        await expectRejection(() => client.query(sql, params), new RegExp(`answered`, 'i'))
        expect(label).toBeTruthy()
      }
    })
  })

  it('permits supersession of an answered proof exactly once, preserving its evidence', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const proof = await answeredProof(order.id)
      await expect(client.query("UPDATE public.design_proofs SET status='superseded', superseded_at=now() WHERE id=$1", [proof])).resolves.toBeTruthy()
      // The original response survives supersession.
      const { rows: [after] } = await client.query('SELECT customer_response_at, customer_comment FROM public.design_proofs WHERE id=$1', [proof])
      expect(after.customer_response_at).not.toBeNull()
      expect(after.customer_comment).toBe('Approved')
      /* Superseding twice would rewrite history. `now()` is fixed for the whole
         transaction, so re-setting it to now() is not a change at all — the probe
         has to use a genuinely different timestamp to test the guard. */
      await expectRejection(
        () => client.query("UPDATE public.design_proofs SET superseded_at = now() + interval '1 hour' WHERE id=$1", [proof]),
        /already superseded/i)
    })
  })

  it('refuses a half-superseded proof, in either direction', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const proof = await answeredProof(order.id)

      /* Either half-state is corrupting, not untidy: the partial unique index
         filters on superseded_at while the production gate reads status, so a
         proof superseded on one column and still 'approved' on the other stays
         valid evidence for production after being replaced. */
      await expectRejection(
        () => client.query('UPDATE public.design_proofs SET superseded_at = now() WHERE id=$1', [proof]),
        /superseded_at together|supersession_consistent/i)
      await expectRejection(
        () => client.query("UPDATE public.design_proofs SET status='superseded' WHERE id=$1", [proof]),
        /superseded_at together|supersession_consistent/i)

      // Both together is the one permitted transition.
      await expect(client.query(
        "UPDATE public.design_proofs SET status='superseded', superseded_at=now() WHERE id=$1", [proof],
      )).resolves.toBeTruthy()
    })
  })

  it('holds the supersession invariant for unanswered proofs too', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      const { rows: [draft] } = await client.query(
        "INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,1,'awaiting_response') RETURNING id", [order.id])

      // The CHECK constraint applies to every row, so the rule cannot be evaded
      // by acting before the customer responds.
      await expectRejection(
        () => client.query('UPDATE public.design_proofs SET superseded_at = now() WHERE id=$1', [draft.id]),
        /supersession_consistent/i)
      await expectRejection(
        () => client.query("UPDATE public.design_proofs SET status='superseded' WHERE id=$1", [draft.id]),
        /supersession_consistent/i)
      await expect(client.query(
        "UPDATE public.design_proofs SET status='superseded', superseded_at=now() WHERE id=$1", [draft.id],
      )).resolves.toBeTruthy()
    })
  })

  it('rejects a half-superseded proof at insert', async () => {
    await inRollback(async () => {
      const order = await newOrder('', [], 'design_in_progress')
      await expectRejection(
        () => client.query("INSERT INTO public.design_proofs(order_id, version, status, superseded_at) VALUES($1,1,'approved',now())", [order.id]),
        /supersession_consistent/i)
      await expectRejection(
        () => client.query("INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,1,'superseded')", [order.id]),
        /supersession_consistent/i)
    })
  })

  it('refuses a proof from another order as approval', async () => {
    await inRollback(async () => {
      const target = await newOrder(', requires_proof_approval', [true], 'design_in_progress')
      const other = await newOrder('', [], 'design_in_progress')
      const foreign = await answeredProof(other.id)
      // Rejected when set, so the invalid state never exists to be exploited.
      await expectRejection(() => client.query('UPDATE public.orders SET approved_proof_id=$1 WHERE id=$2', [foreign, target.id]),
        /belongs to a different order/i)
    })
  })

  it('refuses unanswered and changes-requested proofs as approval', async () => {
    await inRollback(async () => {
      const order = await newOrder(', requires_proof_approval', [true], 'design_in_progress')
      const { rows: [open] } = await client.query(
        "INSERT INTO public.design_proofs(order_id, version, status) VALUES($1,1,'awaiting_response') RETURNING id", [order.id])
      await expectRejection(() => client.query('UPDATE public.orders SET approved_proof_id=$1 WHERE id=$2', [open.id, order.id]),
        /not been approved/i)
      const rejected = await answeredProof(order.id, 2, 'changes_requested')
      await expectRejection(() => client.query('UPDATE public.orders SET approved_proof_id=$1 WHERE id=$2', [rejected, order.id]),
        /not been approved/i)
    })
  })

  it('lets a genuine approval reach production', async () => {
    await inRollback(async () => {
      const order = await newOrder(', requires_proof_approval', [true], 'design_in_progress')
      const proof = await answeredProof(order.id)
      await client.query('UPDATE public.orders SET approved_proof_id=$1 WHERE id=$2', [proof, order.id])
      await expect(client.query("UPDATE public.orders SET status_code='approved' WHERE id=$1", [order.id])).resolves.toBeTruthy()
      await expect(client.query("UPDATE public.orders SET status_code='in_production' WHERE id=$1", [order.id])).resolves.toBeTruthy()
      await expect(client.query("UPDATE public.orders SET status_code='ready' WHERE id=$1", [order.id])).resolves.toBeTruthy()
    })
  })

  it('stores guest tracking tokens hashed, never in plaintext', async () => {
    await inRollback(async () => {
      const order = await newOrder()
      await expectRejection(() => client.query("UPDATE public.orders SET tracking_token='plaintext' WHERE id=$1", [order.id]), /orders_tracking_token_hashed/i)
      await expect(client.query('UPDATE public.orders SET tracking_token=$1 WHERE id=$2', ['a'.repeat(64), order.id])).resolves.toBeTruthy()
    })
  })

  it('enforces catalogue relationships and compatibility rule shape', async () => {
    await inRollback(async () => {
      const { rows: [product] } = await client.query(
        "INSERT INTO public.products(name,slug,pricing_type,quote_required,status) VALUES('A','catalogue-a','configurable',false,'draft') RETURNING id")
      const { rows: [related] } = await client.query(
        "INSERT INTO public.products(name,slug,pricing_type,starting_price,quote_required,status) VALUES('B','catalogue-b','fixed',1000,false,'published') RETURNING id")
      await expect(client.query('INSERT INTO public.product_specifications(product_id,label,value) VALUES($1,$2,$3)', [product.id, 'Material', 'Acrylic'])).resolves.toBeTruthy()
      await expect(client.query('INSERT INTO public.related_products(product_id,related_product_id) VALUES($1,$2)', [product.id, related.id])).resolves.toBeTruthy()
      await expectRejection(() => client.query('INSERT INTO public.related_products(product_id,related_product_id) VALUES($1,$1)', [product.id]), /related_products_check/i)
      await expectRejection(() => client.query(
        'INSERT INTO public.product_option_compatibility_rules(product_id,disallow_selection,message) VALUES($1,$2,$3)',
        [product.id, '{}', 'Invalid']), /check/i)
    })
  })

  it('carries every quote status the lifecycle actually writes', async () => {
    // status_code is a foreign key, so a status the application uses but the
    // lookup lacks is not a cosmetic mismatch — it is a runtime failure.
    const { rows } = await client.query('SELECT code FROM public.quote_statuses')
    const codes = rows.map(row => row.code)
    for (const required of ['submitted', 'under_review', 'prepared', 'sent', 'changes_requested', 'accepted', 'declined', 'expired']) {
      expect(codes, `quote_statuses is missing ${required}`).toContain(required)
    }
  })

  it('carries every order status the production workflow uses', async () => {
    const { rows } = await client.query('SELECT code FROM public.order_statuses')
    const codes = rows.map(row => row.code)
    for (const required of ['new', 'awaiting_payment', 'artwork_required', 'artwork_received', 'design_in_progress',
      'awaiting_customer_approval', 'approved', 'in_production', 'ready', 'dispatched', 'completed', 'cancelled']) {
      expect(codes, `order_statuses is missing ${required}`).toContain(required)
    }
  })

  it('seeded the real Motion taxonomy and no products', async () => {
    const { rows: [counts] } = await client.query(`
      SELECT (SELECT count(*) FROM public.categories WHERE parent_id IS NULL) AS parents,
             (SELECT count(*) FROM public.categories WHERE parent_id IS NOT NULL) AS children,
             (SELECT count(*) FROM public.products) AS products,
             (SELECT count(*) FROM public.projects) AS projects`)
    expect(Number(counts.parents)).toBe(7)
    expect(Number(counts.children)).toBe(24)
    // No invented catalogue or portfolio.
    expect(Number(counts.products)).toBe(0)
    expect(Number(counts.projects)).toBe(0)
  })

  it('freezes an accepted quote against any change of figures', async () => {
    await inRollback(async () => {
      const requestId = await newRequest()
      const quote = await newQuote(requestId)
      await client.query('UPDATE public.quotes SET customer_accepted_at=now(), accepted_total=total_amount WHERE id=$1', [quote.id])

      // The trigger must reject this even though the application never issues it.
      await expectRejection(() => client.query('UPDATE public.quotes SET total_amount=1 WHERE id=$1', [quote.id]), /has been accepted/i)

      // Customer-visible terms are part of what was accepted and are frozen too.
      await expectRejection(() => client.query('UPDATE public.quotes SET notes=$1 WHERE id=$2', ['Different terms', quote.id]), /agreed content/i)
      // Revoking the bearer link does not alter the agreement and remains allowed.
      await expect(client.query('UPDATE public.quotes SET access_token_revoked_at=now() WHERE id=$1', [quote.id])).resolves.toBeTruthy()
    })
  })

  it('freezes accepted quote items against insert, update and delete', async () => {
    await inRollback(async () => {
      const requestId = await newRequest()
      const quote = await newQuote(requestId)
      const { rows: [item] } = await client.query(
        "INSERT INTO public.quote_items(quote_id,title,quantity,unit_price,line_total) VALUES ($1,'Sign',1,500000,500000) RETURNING id",
        [quote.id])
      await client.query("UPDATE public.quotes SET status_code='accepted', customer_accepted_at=now(), accepted_total=total_amount WHERE id=$1", [quote.id])

      await expectRejection(() => client.query('UPDATE public.quote_items SET line_total=1 WHERE id=$1', [item.id]), /line items cannot be changed/i)
      await expectRejection(() => client.query('DELETE FROM public.quote_items WHERE id=$1', [item.id]), /line items cannot be changed/i)
      await expectRejection(() => client.query(
        "INSERT INTO public.quote_items(quote_id,title,quantity,unit_price,line_total) VALUES ($1,'Injected',1,1,1)", [quote.id]), /line items cannot be changed/i)
    })
  })

  it('permits only one live quote per request', async () => {
    await inRollback(async () => {
      const requestId = await newRequest()
      await newQuote(requestId)
      await expectRejection(() => newQuote(requestId), /quotes_one_active_per_request/i)
    })
  })

  it('allows a revision once the previous quote is superseded', async () => {
    await inRollback(async () => {
      const requestId = await newRequest()
      const first = await newQuote(requestId)
      await client.query('UPDATE public.quotes SET superseded_at=now() WHERE id=$1', [first.id])
      // The partial index excludes superseded rows, so version 2 is accepted.
      await expect(newQuote(requestId, { version: 2 })).resolves.toBeTruthy()
    })
  })

  it('permits only one order per accepted quote', async () => {
    await inRollback(async () => {
      const requestId = await newRequest()
      const quote = await newQuote(requestId)
      const insertOrder = () => client.query(
        `INSERT INTO public.orders(order_number, quote_id, contact_name, contact_email, status_code, subtotal, total_amount)
         VALUES ($1,$2,'Ada','ada@example.test','new',500000,500000)`,
        [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, quote.id])
      await insertOrder()
      await expectRejection(insertOrder, /orders_quote_id_key|duplicate key/i)
    })
  })

  it('requires an address on a delivery order', async () => {
    await inRollback(async () => {
      const insert = (method, address) => client.query(
        `INSERT INTO public.orders(order_number, contact_name, contact_email, status_code, subtotal, total_amount, fulfilment_method, delivery_address)
         VALUES ($1,'Ada','ada@example.test','new',1000,1000,$2,$3)`,
        [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, method, address])
      await expectRejection(() => insert('delivery', null), /orders_delivery_needs_address/i)
      await expectRejection(() => insert('delivery', '   '), /orders_delivery_needs_address/i)
      await expect(insert('collection', null)).resolves.toBeTruthy()
      await expect(insert('delivery', 'Plot 4, Kampala')).resolves.toBeTruthy()
    })
  })

  it('accepts the new payment vocabulary and rejects the old one', async () => {
    await inRollback(async () => {
      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders(order_number, contact_name, contact_email, status_code, subtotal, total_amount)
         VALUES ($1,'Ada','ada@example.test','new',1000,1000) RETURNING id`,
        [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`])
      const insert = (status) => client.query(
        'INSERT INTO public.payments(order_id, amount, provider, status) VALUES ($1,1000,$2,$3)',
        [order.id, `test-${Math.random().toString(36).slice(2, 8)}`, status])

      for (const status of ['pending', 'processing', 'successful', 'failed', 'cancelled', 'expired', 'refunded']) {
        await expect(insert(status), `${status} should be accepted`).resolves.toBeTruthy()
      }
      // The vocabulary was replaced, not extended.
      await expectRejection(() => insert('paid'), /payments_status_check/i)
      await expectRejection(() => insert('authorized'), /payments_status_check/i)
    })
  })

  it('makes a repeated webhook delivery impossible to insert twice', async () => {
    await inRollback(async () => {
      const insert = () => client.query("INSERT INTO public.payment_events(provider, event_id, payload) VALUES ('test','evt-1','{}')")
      await insert()
      await expectRejection(insert, /duplicate key/i)
    })
  })

  it('settles payment once and retains an artwork-required order status', async () => {
    await inRollback(async () => {
      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders(order_number,contact_name,contact_email,status_code,subtotal,total_amount)
         VALUES ($1,'Ada','ada@example.test','artwork_required',250000,250000) RETURNING *`,
        [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`])
      const { rows: [payment] } = await client.query(
        `INSERT INTO public.payments(order_id,amount,currency,provider,provider_reference,status)
         VALUES ($1,250000,'UGX','test','verify-once','processing') RETURNING *`, [order.id])
      let queryQueue = Promise.resolve()
      const database = { query: (statement, parameters = []) => {
        const run = queryQueue.then(() => client.query(statement, parameters))
        queryQueue = run.catch(() => {})
        return run.then(result => result.rows)
      } }
      const confirmation = { status: 'successful', amount: '250000', currency: 'UGX' }

      const first = await verifyAndSettle(database, null, { payment, confirmation })
      const replay = await verifyAndSettle(database, null, { payment, confirmation })
      expect(first.changed).toBe(true)
      expect(replay).toMatchObject({ changed: false, reason: 'already_settled' })

      const { rows: [savedOrder] } = await client.query('SELECT status_code FROM public.orders WHERE id=$1', [order.id])
      const { rows: history } = await client.query("SELECT status_code,note FROM public.order_status_history WHERE order_id=$1 AND note LIKE 'Payment confirmed%'", [order.id])
      expect(savedOrder.status_code).toBe('artwork_required')
      expect(history).toHaveLength(1)
      expect(history[0].status_code).toBe('artwork_required')
      expect(history[0].note).toContain('order status retained')
      expect(first.payment.status).toBe(PAYMENT_STATUS.successful)
    })
  })

  it('records a content revision automatically when a value changes', async () => {
    await inRollback(async () => {
      const { rows: [entry] } = await client.query("SELECT id, value FROM public.content_entries WHERE section='hero' LIMIT 1")
      expect(entry).toBeDefined()
      await client.query('UPDATE public.content_entries SET value=$1 WHERE id=$2', [JSON.stringify({ headline: 'Design. Print. Brand.' }), entry.id])
      const { rows } = await client.query('SELECT previous_value, new_value FROM public.content_revisions WHERE content_entry_id=$1', [entry.id])
      // The trigger wrote history without any handler asking it to.
      expect(rows).toHaveLength(1)
      expect(rows[0].new_value).toEqual({ headline: 'Design. Print. Brand.' })
    })
  })

  it('hides a scheduled content entry until its window opens', async () => {
    await inRollback(async () => {
      const visible = `SELECT count(*)::int AS n FROM public.content_entries
        WHERE section='announcement'
          AND (status = 'published' OR (status = 'scheduled' AND publish_from <= now()))
          AND (publish_from IS NULL OR publish_from <= now())
          AND (publish_until IS NULL OR publish_until > now())`

      await client.query("UPDATE public.content_entries SET status='scheduled', publish_from=now() + interval '1 day' WHERE section='announcement'")
      expect((await client.query(visible)).rows[0].n).toBe(0)

      await client.query("UPDATE public.content_entries SET publish_from=now() - interval '1 hour' WHERE section='announcement'")
      expect((await client.query(visible)).rows[0].n).toBeGreaterThan(0)

      // And disappears again once the window closes.
      await client.query("UPDATE public.content_entries SET publish_until=now() - interval '1 minute' WHERE section='announcement'")
      expect((await client.query(visible)).rows[0].n).toBe(0)
    })
  })

  it('publishes scheduled content immediately by clearing its stale window through the API', async () => {
    await inRollback(async () => {
      await client.query("UPDATE public.content_entries SET status='scheduled', is_published=false, publish_from=now() + interval '1 day', publish_until=now() + interval '2 days' WHERE section='announcement'")
      const database = { query: async (statement, parameters = []) => (await client.query(statement, parameters)).rows }
      const api = createApi({
        db: database,
        authenticate: async () => ({ authUserId: '11111111-1111-4111-8111-111111111111', profile: { id: 'admin-profile', role: 'admin' } }),
        logger: { info() {}, error() {} },
      })
      const response = await api(new Request('https://motion.test/api/admin/content/announcement', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'published' }),
      }))
      expect(response.status).toBe(200)
      const { rows: [entry] } = await client.query("SELECT status,is_published,publish_from,publish_until FROM public.content_entries WHERE section='announcement'")
      expect(entry).toMatchObject({ status: 'published', is_published: true, publish_from: null, publish_until: null })
    })
  })

  it('enforces guest quote token expiry and revocation through the API', async () => {
    await inRollback(async () => {
      const token = 'guest-verification-token'
      const requestId = await newRequest()
      const quote = await newQuote(requestId)
      await client.query(
        `UPDATE public.quotes SET sent_at=now(), access_token=$1,
         access_token_expires_at=now() + interval '1 hour', access_token_revoked_at=NULL WHERE id=$2`,
        [hashToken(token), quote.id])
      let queryQueue = Promise.resolve()
      const database = { query: (statement, parameters = []) => {
        const run = queryQueue.then(() => client.query(statement, parameters))
        queryQueue = run.catch(() => {})
        return run.then(result => result.rows)
      } }
      const api = createApi({ db: database, logger: { info() {}, error() {} } })
      const open = () => api(new Request(`https://motion.test/api/quotes/${quote.id}/public?token=${token}`))

      expect((await open()).status).toBe(200)
      await client.query("UPDATE public.quotes SET access_token_expires_at=now() - interval '1 second' WHERE id=$1", [quote.id])
      expect((await open()).status).toBe(404)
      await client.query("UPDATE public.quotes SET access_token_expires_at=now() + interval '1 hour', access_token_revoked_at=now() WHERE id=$1", [quote.id])
      expect((await open()).status).toBe(404)
    })
  })

  it('rejects a negative price and a zero quantity at the database level', async () => {
    await inRollback(async () => {
      await expectRejection(() => client.query(
        `INSERT INTO public.products(name, slug, pricing_type, starting_price, quote_required, status)
         VALUES ('Bad','bad-price','fixed',-1,false,'draft')`), /starting_price/i)

      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders(order_number, contact_name, contact_email, status_code, subtotal, total_amount)
         VALUES ($1,'Ada','ada@example.test','new',0,0) RETURNING id`,
        [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`])
      await expectRejection(() => client.query(
        `INSERT INTO public.order_items(order_id, title, quantity, line_total) VALUES ($1,'Item',0,0)`,
        [order.id]), /quantity/i)
    })
  })

  it('keeps pricing components within the four supported kinds', async () => {
    await inRollback(async () => {
      const { rows: [product] } = await client.query(
        `INSERT INTO public.products(name, slug, pricing_type, quote_required, status)
         VALUES ('Test','test-pricing','configurable',false,'draft') RETURNING id`)
      const insert = (kind) => client.query(
        'INSERT INTO public.pricing_rules(product_id, component_type, price, applies_when) VALUES ($1,$2,1000,$3)',
        [product.id, kind, '{}'])
      for (const kind of ['base', 'quantity_tier', 'surcharge_fixed', 'surcharge_per_unit']) {
        await expect(insert(kind)).resolves.toBeTruthy()
      }
      await expectRejection(() => insert('discount_percentage'), /component_type/i)
    })
  })

  it('runs pricing, checkout and idempotent replay through the API against PostgreSQL', async () => {
    await inRollback(async () => {
      const slug = `api-product-${Math.random().toString(36).slice(2, 8)}`
      const { rows: [product] } = await client.query(
        `INSERT INTO public.products(name,slug,pricing_type,starting_price,quote_required,status,artwork_requirement,published_at)
         VALUES('API product',$1,'fixed',100000,false,'published','required',now()) RETURNING id`, [slug])
      const api = createApi({ db: realDatabase(), logger: { info() {}, error() {} } })

      const priced = await apiJson(await api(new Request('https://motion.test/api/pricing/calculate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 2, selection: {}, total: 1 }),
      })))
      expect(priced.status).toBe(200)
      expect(priced.data.total).toBe('200000')

      const checkoutBody = {
        items: [{ productId: product.id, quantity: 2, selection: {} }],
        contact: { name: 'API Customer', email: 'api@example.test', phone: '0700000000' },
        fulfilment: { method: 'collection' },
      }
      const key = `integration-${crypto.randomUUID()}`
      const place = () => api(new Request('https://motion.test/api/orders', {
        method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(checkoutBody),
      }))
      const created = await apiJson(await place())
      expect(created.status).toBe(201)
      expect(created.data.total).toBe('200000')
      expect(created.data.items[0]).toMatchObject({ artworkStatus: 'awaiting_upload' })
      expect(created.data.items[0].id).toMatch(/^[0-9a-f-]{36}$/)

      const replayed = await apiJson(await place())
      expect(replayed.status).toBe(200)
      expect(replayed.data).toEqual(created.data)
      expect(Number((await client.query('SELECT count(*) AS n FROM public.orders WHERE order_number=$1', [created.data.reference])).rows[0].n)).toBe(1)
      expect(Number((await client.query('SELECT count(*) AS n FROM public.order_items WHERE order_id=$1', [created.data.id])).rows[0].n)).toBe(1)
      expect(Number((await client.query('SELECT count(*) AS n FROM public.order_status_history WHERE order_id=$1', [created.data.id])).rows[0].n)).toBe(1)
    })
  })

  it('serves owned quote lists/details and completes private artwork through the API', async () => {
    await inRollback(async () => {
      const authUserId = crypto.randomUUID()
      const { rows: [profile] } = await client.query(
        "INSERT INTO public.user_profiles(auth_user_id,role,full_name) VALUES($1,'customer','API Owner') RETURNING id", [authUserId])
      const requestId = await newRequest()
      await client.query('UPDATE public.quote_requests SET customer_id=$1 WHERE id=$2', [profile.id, requestId])
      const quote = await newQuote(requestId)
      await client.query("INSERT INTO public.quote_items(quote_id,title,quantity,unit_price,line_total) VALUES($1,'Quoted work',1,500000,500000)", [quote.id])

      const authenticate = async () => ({ authUserId, profile: { id: profile.id, role: 'customer', full_name: 'API Owner' } })
      const storageEvents = []
      const storage = {
        createUploadUrl: async ({ objectKey }) => { storageEvents.push(['intent', objectKey]); return { url: 'https://storage.test/signed', method: 'PUT' } },
        verifyObject: async ({ objectKey }) => storageEvents.push(['verify', objectKey]),
        deleteObject: async ({ objectKey }) => storageEvents.push(['delete', objectKey]),
      }
      const api = createApi({ db: realDatabase(), authenticate, storage, logger: { info() {}, error() {} } })

      const list = await apiJson(await api(new Request('https://motion.test/api/quotes')))
      expect(list.status).toBe(200)
      expect(list.data[0]).toMatchObject({ request_id: requestId, quote_id: quote.id })
      const detail = await apiJson(await api(new Request(`https://motion.test/api/quotes/${quote.id}`)))
      expect(detail.status).toBe(200)
      expect(detail.data.items[0].title).toBe('Quoted work')

      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders(order_number,customer_id,contact_name,contact_email,status_code,subtotal,total_amount)
         VALUES($1,$2,'API Owner','owner@example.test','artwork_required',1000,1000) RETURNING id`,
        [`MOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, profile.id])
      const { rows: [item] } = await client.query(
        "INSERT INTO public.order_items(order_id,title,quantity,unit_price,line_total,artwork_status) VALUES($1,'Print',1,1000,1000,'awaiting_upload') RETURNING id", [order.id])

      const intent = await apiJson(await api(new Request('https://motion.test/api/files/upload-intent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: 'artwork.pdf', mimeType: 'application/pdf', byteSize: 2048, purpose: 'customer_artwork', orderItemId: item.id }),
      })))
      expect(intent.status).toBe(201)
      expect(intent.data.asset.upload_status).toBe('pending')
      const { rows: [pending] } = await client.query('SELECT visibility,upload_status FROM public.media_assets WHERE id=$1', [intent.data.asset.id])
      expect(pending).toMatchObject({ visibility: 'private', upload_status: 'pending' })

      const completed = await apiJson(await api(new Request(`https://motion.test/api/files/${intent.data.asset.id}/complete`, { method: 'POST' })))
      expect(completed.data.upload_status).toBe('available')
      expect((await client.query('SELECT artwork_status FROM public.order_items WHERE id=$1', [item.id])).rows[0].artwork_status).toBe('received')
      expect((await client.query('SELECT status_code FROM public.orders WHERE id=$1', [order.id])).rows[0].status_code).toBe('artwork_received')
      const removed = await apiJson(await api(new Request(`https://motion.test/api/files/${intent.data.asset.id}`, { method: 'DELETE' })))
      expect(removed.data.removed).toBe(true)
      expect(storageEvents.map(event => event[0])).toEqual(['intent', 'verify', 'delete'])
      expect((await client.query('SELECT id FROM public.media_assets WHERE id=$1', [intent.data.asset.id])).rows).toHaveLength(0)
      expect((await client.query('SELECT artwork_status FROM public.order_items WHERE id=$1', [item.id])).rows[0].artwork_status).toBe('awaiting_upload')
      expect((await client.query('SELECT status_code FROM public.orders WHERE id=$1', [order.id])).rows[0].status_code).toBe('artwork_required')
    })
  })
})
