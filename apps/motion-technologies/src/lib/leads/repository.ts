/**
 * Persistence for Technologies inquiries and assistant handoffs, into the
 * shared `inquiries` and `chat_leads` tables with site = 'technologies'.
 *
 * The database client and reference maker are injected, so tests exercise
 * the real logic against a fake client.
 */
import type { Lead } from "./validate";

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

export type LeadRepository = {
  saveLead(lead: Lead): Promise<Saved>;
  saveHandoff(handoff: Handoff): Promise<Saved>;
  markNotified(id: number): Promise<void>;
};

const ATTEMPTS = 4;
const isUnique = (e: unknown) =>
  typeof e === "object" &&
  e !== null &&
  (e as { code?: string }).code === "23505";

export function createLeadRepository(
  connect: Connect,
  makeRef: (kind: "T" | "A") => string,
): LeadRepository {
  async function once<T>(fn: (c: Queryable) => Promise<T>) {
    for (let attempt = 1; ; attempt++) {
      const client = await connect();
      try {
        return await fn(client);
      } catch (error) {
        if (!isUnique(error) || attempt >= ATTEMPTS) throw error;
      } finally {
        client.release();
      }
    }
  }

  return {
    saveLead(lead) {
      return once(async (c) => {
        const reference = makeRef("T");
        const { source } = lead;
        const r = await c.query(
          `INSERT INTO inquiries (reference, site, topic, subject, name, organisation,
             phone, whatsapp, email, location, message, context, source_path, referrer,
             utm_source, utm_medium, utm_campaign, utm_term, utm_content)
           VALUES ($1,'technologies',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18)
           RETURNING id`,
          [
            reference,
            lead.solution,
            lead.requestType,
            lead.name,
            lead.organisation,
            lead.phone,
            lead.whatsapp,
            lead.email,
            lead.location,
            lead.message,
            JSON.stringify({
              role: lead.role,
              requestType: lead.requestType,
              timeline: lead.timeline,
            }),
            source.path,
            source.referrer,
            source.utmSource,
            source.utmMedium,
            source.utmCampaign,
            source.utmTerm,
            source.utmContent,
          ],
        );
        return { reference, id: Number(r.rows[0].id) };
      });
    },

    saveHandoff(h) {
      return once(async (c) => {
        const reference = makeRef("A");
        const r = await c.query(
          `INSERT INTO chat_leads (reference, site, summary, name, phone, email, source_path)
           VALUES ($1,'technologies',$2,$3,$4,$5,$6) RETURNING id`,
          [reference, h.summary, h.name, h.phone, h.email, h.sourcePath],
        );
        return { reference, id: Number(r.rows[0].id) };
      });
    },

    async markNotified(id) {
      const client = await connect();
      try {
        await client.query(
          "UPDATE inquiries SET notified_at = now() WHERE id = $1",
          [id],
        );
      } finally {
        client.release();
      }
    },
  };
}

/** Development-only store so the flow can be tried without a database. */
export function createMemoryLeadRepository(
  makeRef: (kind: "T" | "A") => string,
): LeadRepository & { leads: unknown[]; handoffs: unknown[] } {
  const leads: unknown[] = [];
  const handoffs: unknown[] = [];
  return {
    leads,
    handoffs,
    async saveLead(lead) {
      const reference = makeRef("T");
      leads.push({ reference, ...lead });
      return { reference, id: leads.length };
    },
    async saveHandoff(h) {
      const reference = makeRef("A");
      handoffs.push({ reference, ...h });
      return { reference, id: handoffs.length };
    },
    async markNotified() {},
  };
}
