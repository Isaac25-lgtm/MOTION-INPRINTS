/**
 * Server-side validation for Technologies project inquiries.
 *
 * Pure: no framework or value imports, so tests load it directly. The caller
 * passes the list of known solution slugs; anything else becomes "general".
 * Only a few solution-specific fields are asked for, per the master handoff:
 * enough to follow up well, not a procurement questionnaire.
 */

export const MAX_BODY_BYTES = 24 * 1024;

export const REQUEST_TYPES = ["discuss", "demo", "quote"] as const;
export const TIMELINES = [
  "exploring",
  "within-3-months",
  "3-6-months",
  "later",
] as const;

export type SourceInfo = {
  path: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
};

export type Lead = {
  name: string;
  organisation: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
  location: string;
  solution: string;
  requestType: (typeof REQUEST_TYPES)[number];
  timeline: (typeof TIMELINES)[number] | "";
  message: string;
  source: SourceInfo;
};

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string>; spam?: boolean };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

const PHONE = /^\+?[0-9][0-9 ()-]{5,22}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const digits = (p: string) => p.replace(/\D/g, "").length;

export function validPhone(phone: string) {
  return PHONE.test(phone) && digits(phone) >= 7 && digits(phone) <= 15;
}

export function validEmail(email: string) {
  return EMAIL.test(email);
}

function source(v: unknown): SourceInfo {
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

export function validateLead(
  input: unknown,
  solutions: readonly string[],
): Result<Lead> {
  if (!isObj(input))
    return { ok: false, errors: { form: "The message was not readable." } };
  if (text(input.website, 200) !== "")
    return { ok: false, errors: { form: "Request rejected." }, spam: true };

  const errors: Record<string, string> = {};

  const name = text(input.name, 120);
  if (name.length < 2) errors.name = "Enter your name.";

  const organisation = text(input.organisation, 160);
  if (organisation.length < 2)
    errors.organisation = "Enter your organisation or business name.";

  const phone = text(input.phone, 30);
  if (!validPhone(phone))
    errors.phone =
      "Enter a phone number we can call, including the country code.";

  let whatsapp = "";
  if (input.whatsappSame === true) whatsapp = phone;
  else {
    whatsapp = text(input.whatsapp, 30);
    if (whatsapp && !validPhone(whatsapp))
      errors.whatsapp = "Enter a valid WhatsApp number, or leave it empty.";
  }

  const email = text(input.email, 254);
  if (email && !validEmail(email))
    errors.email = "Enter a valid email address, or leave it empty.";

  const message = text(input.message, 4000);
  if (message.length < 10)
    errors.message = "Tell us a little about the work: at least a sentence.";

  if (input.consent !== true)
    errors.consent = "Please confirm we may contact you about this inquiry.";

  const rawSolution = text(input.solution, 60);
  const solution = solutions.includes(rawSolution) ? rawSolution : "general";

  const rawType = text(input.requestType, 20);
  const requestType = (REQUEST_TYPES as readonly string[]).includes(rawType)
    ? (rawType as Lead["requestType"])
    : "discuss";

  const rawTimeline = text(input.timeline, 30);
  const timeline = (TIMELINES as readonly string[]).includes(rawTimeline)
    ? (rawTimeline as Lead["timeline"])
    : "";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      organisation,
      role: text(input.role, 120),
      phone,
      whatsapp,
      email,
      location: text(input.location, 160),
      solution,
      requestType,
      timeline,
      message,
      source: source(input.source),
    },
  };
}
