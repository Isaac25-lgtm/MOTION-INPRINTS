/**
 * Server-side validation for quote requests and inquiries.
 *
 * Pure: no framework or value imports, so tests load it directly. The caller
 * passes a catalogue lookup; every accepted item is re-snapshotted from the
 * catalogue, so a tampered title, unit or option never reaches the database.
 */

export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_ITEMS = 30;

export type CatalogueEntry = {
  title: string;
  unit: string;
  options: { id: string; label: string; choices: string[] }[];
};
export type CatalogueLookup = (slug: string) => CatalogueEntry | null;

export type SourceInfo = {
  path: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
};

export type Contact = {
  name: string;
  organisation: string;
  phone: string;
  whatsapp: string;
  email: string;
  location: string;
};

export type ItemSnapshot = {
  slug: string;
  title: string;
  unit: string;
  options: { label: string; choice: string }[];
  quantity: number;
  notes: string;
};

export type QuoteRequest = {
  contact: Contact;
  deadline: string | null;
  notes: string;
  items: ItemSnapshot[];
  source: SourceInfo;
};

export type Inquiry = {
  contact: Contact;
  topic: string;
  subject: string;
  message: string;
  source: SourceInfo;
};

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string>; spam?: boolean };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // Strip control characters except newlines and tabs, then trim.
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

const PHONE = /^\+?[0-9][0-9 ()-]{5,22}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function digits(phone: string) {
  return phone.replace(/\D/g, "").length;
}

function validateContact(body: Obj, errors: Record<string, string>): Contact {
  const name = text(body.name, 120);
  if (name.length < 2) errors.name = "Enter your name.";

  const phone = text(body.phone, 30);
  if (!PHONE.test(phone) || digits(phone) < 7 || digits(phone) > 15)
    errors.phone =
      "Enter a phone number we can call, for example +256 700 000000.";

  let whatsapp = "";
  if (body.whatsappSame === true) whatsapp = phone;
  else {
    whatsapp = text(body.whatsapp, 30);
    if (whatsapp && (!PHONE.test(whatsapp) || digits(whatsapp) < 7))
      errors.whatsapp = "Enter a valid WhatsApp number, or leave it empty.";
  }

  const email = text(body.email, 254);
  if (email && !EMAIL.test(email))
    errors.email = "Enter a valid email address, or leave it empty.";

  const location = text(body.location, 160);
  if (location.length < 2)
    errors.location = "Tell us the town or area for delivery or installation.";

  return {
    name,
    organisation: text(body.organisation, 160),
    phone,
    whatsapp,
    email,
    location,
  };
}

function validateSource(v: unknown): SourceInfo {
  const s = isObj(v) ? v : {};
  return {
    path: text(s.path, 200),
    referrer: text(s.referrer, 300),
    utmSource: text(s.utmSource, 100),
    utmMedium: text(s.utmMedium, 100),
    utmCampaign: text(s.utmCampaign, 150),
    utmTerm: text(s.utmTerm, 150),
    utmContent: text(s.utmContent, 150),
  };
}

function common(body: unknown) {
  const errors: Record<string, string> = {};
  if (!isObj(body)) return { body: {} as Obj, errors, bad: true, spam: false };
  // Honeypot: a field people never see. Anything in it means automation.
  const spam = text(body.website, 200) !== "";
  if (body.consent !== true)
    errors.consent = "Please confirm we may contact you about this request.";
  return { body, errors, bad: false, spam };
}

/** Today's date as YYYY-MM-DD in the given offset (default East Africa Time). */
export function todayIso(now: Date, offsetMinutes = 180) {
  return new Date(now.getTime() + offsetMinutes * 60000)
    .toISOString()
    .slice(0, 10);
}

export function validateQuote(
  input: unknown,
  lookup: CatalogueLookup,
  now = new Date(),
): Result<QuoteRequest> {
  const { body, errors, bad, spam } = common(input);
  if (bad)
    return { ok: false, errors: { form: "The request was not readable." } };
  if (spam)
    return { ok: false, errors: { form: "Request rejected." }, spam: true };

  const contact = validateContact(body, errors);

  let deadline: string | null = null;
  const rawDeadline = text(body.deadline, 10);
  if (rawDeadline) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) ||
      isNaN(Date.parse(rawDeadline))
    )
      errors.deadline = "Enter the date as a calendar date.";
    else if (rawDeadline < todayIso(now))
      errors.deadline = "The date you need it by is in the past.";
    else deadline = rawDeadline;
  }

  const items: ItemSnapshot[] = [];
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) errors.items = "Your quote list is empty.";
  if (rawItems.length > MAX_ITEMS)
    errors.items = `A request can hold up to ${MAX_ITEMS} items.`;

  rawItems.slice(0, MAX_ITEMS).forEach((raw, i) => {
    const key = `items.${i}`;
    if (!isObj(raw)) {
      errors[key] = "This item is not readable.";
      return;
    }
    const slug = text(raw.slug, 80);
    const entry = lookup(slug);
    if (!entry) {
      errors[key] = "This product is no longer in the catalogue.";
      return;
    }
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      errors[key] = "Enter a whole-number quantity.";
      return;
    }
    const chosen = isObj(raw.options) ? raw.options : {};
    const options: ItemSnapshot["options"] = [];
    for (const group of entry.options) {
      const value = chosen[group.id];
      if (value === undefined || value === "") {
        options.push({ label: group.label, choice: "Not specified" });
      } else if (typeof value === "string" && group.choices.includes(value)) {
        options.push({ label: group.label, choice: value });
      } else {
        errors[key] =
          `Choose a listed option for ${group.label.toLowerCase()}.`;
        return;
      }
    }
    items.push({
      slug,
      title: entry.title,
      unit: entry.unit,
      options,
      quantity,
      notes: text(raw.notes, 600),
    });
  });

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      contact,
      deadline,
      notes: text(body.notes, 2000),
      items,
      source: validateSource(body.source),
    },
  };
}

export const INQUIRY_TOPICS = [
  "general",
  "design",
  "printing",
  "branding",
  "signage",
  "packaging",
  "corporate",
  "product",
  "feedback",
] as const;

export function validateInquiry(input: unknown): Result<Inquiry> {
  const { body, errors, bad, spam } = common(input);
  if (bad)
    return { ok: false, errors: { form: "The message was not readable." } };
  if (spam)
    return { ok: false, errors: { form: "Request rejected." }, spam: true };

  const contact = validateContact(body, errors);
  // Location is optional for a general message.
  if (errors.location && !text(body.location, 160)) delete errors.location;

  const topicRaw = text(body.topic, 40);
  const topic = (INQUIRY_TOPICS as readonly string[]).includes(topicRaw)
    ? topicRaw
    : "general";
  const message = text(body.message, 4000);
  if (message.length < 10)
    errors.message = "Tell us a little more: at least a sentence.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      contact,
      topic,
      subject: text(body.subject, 160),
      message,
      source: validateSource(body.source),
    },
  };
}
