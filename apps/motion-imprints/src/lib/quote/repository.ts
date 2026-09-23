/**
 * Persistence for quote requests (orders) and inquiries.
 *
 * Pure with respect to imports: the database client and the reference maker
 * are injected, so tests exercise the real transaction logic against a fake
 * client without a database.
 */
import type { Inquiry, QuoteRequest } from "./validate";

export type Queryable = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
};

export type Connect = () => Promise<Queryable>;

export type Saved = { reference: string; id: number };

export type Handoff = {
  summary: string;
  name: string;
  phone: string;
  email: string;
  sourcePath: string;
};

export type Repository = {
  saveQuote(request: QuoteRequest): Promise<Saved>;
  saveInquiry(
    inquiry: Inquiry,
    site: "imprints" | "technologies",
  ): Promise<Saved>;
  markNotified(table: "orders" | "inquiries", id: number): Promise<void>;
  /** Assistant "talk to a person": the approved summary only (chat_leads). */
  saveHandoff(handoff: Handoff): Promise<Saved>;
};

const UNIQUE_VIOLATION = "23505";
const ATTEMPTS = 4;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

export function createRepository(
  connect: Connect,
  makeRef: (kind: "Q" | "M" | "A") => string,
): Repository {
  async function withTransaction<T>(fn: (c: Queryable) => Promise<T>) {
    const client = await connect();
    try {
      await client.query("BEGIN");
      const out = await fn(client);
      await client.query("COMMIT");
      return out;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function retrying<T>(fn: () => Promise<T>) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        // A reference collision rolls the whole transaction back; try again
        // with a fresh reference.
        if (!isUniqueViolation(error) || attempt >= ATTEMPTS) throw error;
      }
    }
  }

  return {
    saveQuote(request) {
      return retrying(() =>
        withTransaction(async (c) => {
          const reference = makeRef("Q");
          const { contact, source } = request;
          const order = await c.query(
            `INSERT INTO orders (reference, name, organisation, phone, whatsapp, email,
               location, deadline, notes, source_path, referrer, utm_source, utm_medium,
               utm_campaign, utm_term, utm_content)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             RETURNING id`,
            [
              reference,
              contact.name,
              contact.organisation,
              contact.phone,
              contact.whatsapp,
              contact.email,
              contact.location,
              request.deadline,
              request.notes,
              source.path,
              source.referrer,
              source.utmSource,
              source.utmMedium,
              source.utmCampaign,
              source.utmTerm,
              source.utmContent,
            ],
          );
          const id = Number(order.rows[0].id);
          for (const [position, item] of request.items.entries()) {
            await c.query(
              `INSERT INTO order_items (order_id, position, product_slug, product_title,
                 unit, quantity, options, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
              [
                id,
                position + 1,
                item.slug,
                item.title,
                item.unit,
                item.quantity,
                JSON.stringify(item.options),
                item.notes,
              ],
            );
          }
          return { reference, id };
        }),
      );
    },

    saveInquiry(inquiry, site) {
      return retrying(() =>
        withTransaction(async (c) => {
          const reference = makeRef("M");
          const { contact, source } = inquiry;
          const row = await c.query(
            `INSERT INTO inquiries (reference, site, topic, subject, name, organisation,
               phone, whatsapp, email, location, message, source_path, referrer,
               utm_source, utm_medium, utm_campaign, utm_term, utm_content)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING id`,
            [
              reference,
              site,
              inquiry.topic,
              inquiry.subject,
              contact.name,
              contact.organisation,
              contact.phone,
              contact.whatsapp,
              contact.email,
              contact.location,
              inquiry.message,
              source.path,
              source.referrer,
              source.utmSource,
              source.utmMedium,
              source.utmCampaign,
              source.utmTerm,
              source.utmContent,
            ],
          );
          return { reference, id: Number(row.rows[0].id) };
        }),
      );
    },

    saveHandoff(h) {
      return retrying(async () => {
        const client = await connect();
        try {
          const reference = makeRef("A");
          const r = await client.query(
            `INSERT INTO chat_leads (reference, site, summary, name, phone, email, source_path)
             VALUES ($1,'imprints',$2,$3,$4,$5,$6) RETURNING id`,
            [reference, h.summary, h.name, h.phone, h.email, h.sourcePath],
          );
          return { reference, id: Number(r.rows[0].id) };
        } finally {
          client.release();
        }
      });
    },

    async markNotified(table, id) {
      const client = await connect();
      try {
        await client.query(
          `UPDATE ${table === "orders" ? "orders" : "inquiries"} SET notified_at = now() WHERE id = $1`,
          [id],
        );
      } finally {
        client.release();
      }
    },
  };
}

/** Development-only store, so the flow can be exercised without a database. */
export function createMemoryRepository(
  makeRef: (kind: "Q" | "M" | "A") => string,
): Repository & { orders: unknown[]; inquiries: unknown[] } {
  const orders: unknown[] = [];
  const inquiries: unknown[] = [];
  const handoffs: unknown[] = [];
  return {
    orders,
    inquiries,
    async saveHandoff(h) {
      const reference = makeRef("A");
      handoffs.push({ reference, ...h });
      return { reference, id: handoffs.length };
    },
    async saveQuote(request) {
      const reference = makeRef("Q");
      orders.push({ reference, ...request });
      return { reference, id: orders.length };
    },
    async saveInquiry(inquiry, site) {
      const reference = makeRef("M");
      inquiries.push({ reference, site, ...inquiry });
      return { reference, id: inquiries.length };
    },
    async markNotified() {},
  };
}
