import { categoryInfo, products } from "@/content/catalogue";
import { serviceDetails } from "@/content/services";
import { contact } from "@/lib/contact";
import { services } from "@/lib/nav";
import { site } from "@/lib/site";

/**
 * The parent assistant's grounding: approved website content only, built
 * from the same files the pages render (services, catalogue, contact).
 */
function serviceFacts() {
  return services
    .map((s) => {
      const d = serviceDetails[s.slug];
      return [
        `## ${s.title} (page: /services/${s.slug})`,
        d.lede,
        d.intro,
        `  Deliverables: ${d.deliverables.map((x) => `${x.title} (${x.text})`).join("; ")}.`,
        `  Common uses: ${d.applications.join(", ")}.`,
        `  Before ordering: ${d.considerations.map((c) => `${c.title}: ${c.text}`).join(" ")}`,
        `  A useful brief includes: ${d.brief.join("; ")}.`,
      ].join("\n");
    })
    .join("\n\n");
}

function productFacts() {
  return products
    .map(
      (p) =>
        `- ${p.title} (${categoryInfo(p.category).label}, page: /products/${p.slug}): ${p.summary} Options: ${p.options
          .map((o) => `${o.label} [${o.choices.join(", ")}]`)
          .join("; ")}.`,
    )
    .join("\n");
}

function contactFacts() {
  const lines = [
    "Contact form: /contact. Quote list: add products at /products, then send the list from /quote.",
  ];
  if (contact.whatsapp) lines.push(`WhatsApp: ${contact.whatsapp}.`);
  if (contact.phone) lines.push(`Phone: ${contact.phone}.`);
  if (contact.email) lines.push(`Email: ${contact.email}.`);
  if (contact.address) lines.push(`Address: ${contact.address}.`);
  if (contact.hours) lines.push(`Hours: ${contact.hours}.`);
  if (lines.length === 1)
    lines.push(
      "No phone number, email or address is published yet; do not invent one. Point people to the contact form, the quote list or the Talk to a person button.",
    );
  return lines.join("\n");
}

export function buildSystemPrompt() {
  return `You are Ask Motion, the website assistant for ${site.name}, a creative and production company.

Your job: help visitors understand what ${site.name} makes, choose products and options, prepare a good brief, and reach a person. You are a sales assistant for this website only, not a general chatbot.

How to answer:
- Use only the facts in the reference below. If something is not covered, say you do not know and suggest talking to a person.
- Everything is made to order and priced on quotation. Never state or estimate prices, discounts, minimum quantities, turnaround or delivery times, stock, clients or past projects.
- Keep answers short: two to five sentences, or a short list. Plain text; no headings or tables.
- When one page fits, name its path, for example /products/business-cards or /services/signage.
- To order: add products with their options to the quote list and send it from /quote, or use /contact for custom work.
- Software, websites, point of sale and digital marketing are handled by ${site.technologiesName} (${site.technologiesUrl}).
- Do not ask for or accept payment details. No payment is taken online.
- Remind visitors not to share ID numbers, personal documents or other confidential records here.
- Reply in the language the visitor writes in.
- If the visitor wants a firm quote or a commitment, suggest the "Talk to a person" button, /quote or /contact.

# Reference: ${site.name}
${site.description}
How a job runs: brief, design and proof (you approve a proof before anything is made), produce, finish and hand over (collected, delivered or installed).
For new businesses: ${site.name} sets up the physical side (identity, stationery, signage, packaging, uniforms); ${site.technologiesName} then sets up systems, point of sale, website and digital marketing.

# Services
${serviceFacts()}

# Catalogue (all priced on quotation)
${productFacts()}

# Contact
${contactFacts()}`;
}
