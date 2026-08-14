# Commerce architecture — Categories 5–8

How pricing, carts, quotes, orders and payments fit together, and which rules are enforced where.

## The single rule

**The browser describes what it wants; the server decides what that costs.**

No request body carries a price. `/api/pricing/calculate`, `/api/cart/validate` and `POST /api/orders` all reload the product, its options and its pricing components from the database and recalculate. Editing localStorage, a form field or a JSON payload changes nothing.

Verified in `tests/security.test.js`: a cart claiming `UGX 1` for a `UGX 100,000` product is charged 100,000.

## Money

UGX circulates in whole shillings, so **every amount is an integer number of shillings** inside the application (`server/money.js`). Database columns stay `numeric(14,2)` and accept integers unchanged.

Two rules:

1. **No floating-point arithmetic.** Integer shillings are exact in JavaScript far past any realistic invoice.
2. **Percentages are basis points.** VAT is `mulRate(amount, 1800)`, never `amount * 0.18` — which yields `22500.000000000004`.

Money crosses the API as **strings**, so no consumer can reintroduce float error by parsing it.

## Pricing engine

`server/pricing.js` — a pure function. No database, no clock, no randomness, and therefore directly testable.

Components compose in this order:

| Kind | Behaviour |
| --- | --- |
| `base` | Per-unit starting amount |
| `quantity_tier` | Replaces the base; prices the **whole run**, not each unit |
| `surcharge_fixed` | Added once at any quantity |
| `surcharge_per_unit` | Multiplied by quantity |

A component applies only when every entry in its `applies_when` map matches the selection. The most specific match wins, ties break on stored priority.

Worked examples from the brief, both covered by tests:

- **100 business cards + double-sided + matte** → 90,000 tier + 15,000 + 20,000 = **125,000**
- **20 T-shirts with embroidery** → (25,000 + 6,500) × 20 + 40,000 setup = **670,000**

Any option value or component flagged `requires_quote` makes the whole configuration a quotation. **A missing price is never rendered as zero** — it becomes "Request a quote".

Cross-option compatibility is stored in `product_option_compatibility_rules`. A
configuration such as a material/finish combination that Motion cannot produce is
rejected by the same server engine used by pricing, cart validation and checkout.
The frontend cannot bypass the rule by calling a later endpoint directly.

## Cart

Client-side (`localStorage`), so guests keep a cart across refresh and browser restart with no server session. It stores **intent only** — product, quantity, options. Every figure displayed comes from `/api/cart/validate`.

Opening the cart is therefore also when a withdrawn product, an invalid saved configuration or a changed price is discovered and reported. Two lines are the same only if product *and* full configuration match, so one T-shirt in two colours is two lines.

Quote-only configurations are marked `purchasable: false` and cannot be checked out.

## Quotes

Lifecycle: `submitted → under_review → prepared → sent → accepted | changes_requested | declined | expired`

Enforcement, and where:

| Rule | Enforced by |
| --- | --- |
| Only staff set prices | `requireAdmin` on every write path |
| **An accepted quote is immutable** | Database trigger `freeze_accepted_quote` |
| One live quote per request | Partial unique index |
| A revision supersedes, never overwrites | New row + `supersedes_quote_id` |
| Expired or superseded cannot be accepted | `assertAcceptable` |
| **One order per accepted quote** | `orders.quote_id UNIQUE` |

Tax applies **only when a rate is configured**. A null `tax_rate_bp` means no tax — the brief forbids assuming a VAT treatment, so nothing is assumed.

Guest access uses a 32-byte token whose SHA-256 hash is stored in the database. It is compared in **constant time**, expires, can be rotated or revoked, and an invalid credential returns the same 404 as a missing quote. Plaintext is returned exactly once when staff send or rotate the link.

## Orders

Created in one transaction: order, every item, opening history and the idempotency response. A failure part-way leaves no half-created order.

**Idempotency**: a repeat with the same key *and* same body replays the stored response; a repeat with the same key and a **different** body is a `409 conflict`. The key is reserved in the order transaction, so a concurrent duplicate either wins that transaction or resolves to its stored order.

References are drawn from a CSPRNG over an alphabet excluding `I O 0 1`, so `MOT-K7P2QX` cannot be misread over the phone. **No database id, timestamp or sequence is exposed** — the previous scheme embedded `Date.now()`, which leaked order timing.

## Payments

No provider is selected. `server/payments.js` defines the contract; Prompt 8.5 implements one against it.

**A browser can never mark an order paid.** `verifyAndSettle` is the only path to `successful`, and it requires a server-side confirmation matching on **both amount and currency**. A mismatch marks the payment failed and records why. A redirect back from a provider is a hint to go and check, nothing more.

- Unknown provider status → `failed`, never `successful`.
- Repeat settlement of a settled payment is **inert**, not an error.
- Payment settlement, the conditional order transition and history are one atomic SQL statement. Existing artwork/production states are retained.
- Webhook deliveries are recorded before processing; `UNIQUE(provider, event_id)` makes replays inert.
- Only PostgreSQL unique violation `23505` means replay; storage and connection failures return a retryable error.
- Payloads are scrubbed of anything matching `secret|signature|token|authorization|password|card|cvv|pan|expiry|pin` before storage.

## Migrations

`node db/migrate.js [--dry-run]` takes a PostgreSQL advisory lock, applies `db/migrations/*.sql` in order, records each in `schema_migrations`, and **refuses to run a file whose contents changed after it was applied**. An edited migration is a different migration.

Reads `DATABASE_URL` from the environment; never accepts a connection string as an argument, so it cannot land in shell history.

| File | Adds |
| --- | --- |
| `0003_pricing_components` | Component model, quantity bounds, artwork requirement, option surcharges |
| `0004_quotes_and_orders` | Quote versioning + immutability trigger, guest tokens, fulfilment, idempotency, payment status vocabulary, webhook events |
| `0005_portfolio_and_cms` | Project type/scope/priority, **client-name privacy**, media orientation, relationships, CMS scheduling + audit trigger |
| `0006_quote_status_vocabulary` | Reconciled quote lifecycle status codes |
| `0007_accepted_quote_immutability` | Accepted line-item freeze, hashed-token expiry and revocation fields |
| `0008_quote_access_and_lifecycle` | Full accepted-header freeze and SHA-256 token constraint |
| `0009_catalogue_relationships_and_uploads` | Product specifications, editorial related products, option compatibility and upload lifecycle |

`0004` **replaces** the payment status constraint rather than extending it — the original allowed `paid`/`authorized`, which cannot express Prompt 8.4's states. Existing rows are migrated, not stranded.

## Artwork

Artwork uses a private, owner-scoped upload-intent flow. The browser validates
type and size, transfers to a short-lived provider URL, then asks the API to
verify and complete the asset. Database rows start `pending`; failed transfers
are never presented as available files. Completion advances the item and order
from `awaiting_upload` / `artwork_required` to `received` /
`artwork_received`. Removing the last available artwork reverses those states.

The UI reports filename, size, progress, failure and completion, and supports
retry, remove and replacement. It becomes operational when the object-storage
adapter and Neon Auth session are configured; neither is simulated in production.

## Deliberately deferred

- **8.5 payment gateway** — deliberately held until a provider is chosen. `createUnconfiguredProvider` fails loudly with a clear message rather than pretending.
- **Delivery pricing** — no business rule exists, so no figure is shown. Checkout says the cost is confirmed separately rather than inventing one.
- **Live artwork storage** — the complete private upload workflow exists, but transfer remains unavailable until Neon Object Storage (or the approved initial object-storage service) is provisioned.
- **Live account sessions** — `/account/quotes` and `/account/quotes/:id` are implemented and ownership-protected; Neon Auth still has to be configured before a browser can sign in.

The integration suite exercises the migration chain, database constraints and
real API calls for pricing, checkout/idempotency, customer quotes, CMS, guest
tokens and artwork lifecycle against the local PostgreSQL 18 verification instance. The remaining tests use
bounded in-process doubles. Neon deployment remains an infrastructure prerequisite.
