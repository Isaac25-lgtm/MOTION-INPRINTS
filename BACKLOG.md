# Post-launch backlog — Prompt 10.9

Nothing here is implemented. This is a prioritised list to work from *after* the MVP is live.

Ordered by what actually moves revenue, order completion or owner time — not by what is interesting to build.

---

## P1 — Important soon

### Payment provider integration
**Problem:** Motion cannot take money online. Every order ends in a phone call to arrange payment.
**Who benefits:** Both — customers who want to pay immediately, and the owner who currently chases every payment.
**Value:** High. This is the difference between an order system and a shop.
**Why now:** The abstraction is written and tested; only the adapter is missing.
**Depends on:** Merchant account. Compare Uganda providers on MTN/Airtel support, settlement period, per-transaction cost and onboarding before choosing.

### Email and WhatsApp notifications
**Problem:** A customer learns their proof is ready only by logging in. Most will not.
**Who benefits:** Customers waiting on approval; the owner chasing responses.
**Value:** High — proof approval is the most common place a job stalls.
**Why now:** Event hooks already exist at the right points. WhatsApp matters more than email in this market.
**Depends on:** A messaging provider. Never claim a message was sent unless it was.

### Real photography and portfolio content
**Problem:** The site is image-led and currently shows placeholders.
**Who benefits:** Every visitor. This is the single largest factor in whether the site looks credible.
**Value:** Very high, and no code required.
**Depends on:** Motion supplying originals.

### Admin CMS editing screen
**Problem:** Content can only be changed through the API. The owner cannot edit their own hero copy or contact details.
**Value:** High — the CMS exists precisely so the owner is not dependent on a developer.
**Why now:** Backend, scheduling and audit trail are done; only the form is missing.

### Media library UI
**Problem:** Files can be uploaded but not browsed, replaced or tidied.
**Value:** High once real photography arrives, and the separation between public business media and private customer artwork must be visible in the interface, not just enforced underneath.

---

## P2 — Valuable growth

### Downloadable PDF invoices and quotes
Customers with company accounting need a document, not a web page. The quote view is already set as a business document; PDF is the missing output.

### Delivery pricing rules
Checkout currently says delivery is confirmed separately. Zone or distance-based pricing removes a manual step per order, but needs the owner's actual rates first.

### Saved addresses and repeat-customer defaults
Corporate customers reorder to the same place. Small time saving, repeated often.

### Reporting improvements
CSV export and a production-throughput view. The metrics and definitions exist; this is presentation.

### Improved search
Current search is substring matching. Postgres full-text with ranking would help once the catalogue is large enough to need it — not before.

### Reorder from within the cart
Currently reorder sends the customer back to the product page to reconfigure. Adding a validated line straight to the cart is fewer steps, but only safe once compatibility rules are well exercised.

---

## P3 — Later

### Corporate accounts with multiple users
Several staff ordering under one company, shared order history, purchase-order references. Only worth building when a real customer asks twice.

### Deeper stock and materials tracking
Motion produces to order, so inventory matters less than for a retailer. Revisit if material shortages start affecting lead times.

### POS integration
Motion sells POS systems; connecting the website to an in-shop till is a different product. Treat as a separate project.

### Multi-branch support
Only if a second location opens.

---

## Deliberately not recommended

**AI chatbot, recommendation engine, native mobile app, microservices, Kubernetes, full ERP.** None solves a problem Motion currently has. The site is a catalogue with a quotation workflow; splitting it into services or bolting on a model would add operational burden with no customer benefit. Revisit only if actual usage creates the need.

**Paid infrastructure upgrades.** Render and Neon free tiers are untested under real load. Measure before buying capacity.

---

## Design protection

Every item above must go through the existing design system. The specific risks as features accumulate:

- The admin area drifting into generic dashboard software — KPI tiles, gauges, growth arrows. Admin screens are work queues; keep them as lists and tables.
- The customer portal acquiring engagement metrics or reward points. Prompt 9.1 banned these for good reason: they are not what someone waiting on a signage job needs.
- New pages introducing gradients, glow, oversized radii or emoji icons. `tests/design-system.test.js` fails the build on these — keep it that way, and extend it rather than working around it.

The interface frames Motion's work. It should never compete with it.
