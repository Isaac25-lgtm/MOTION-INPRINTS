/**
 * Public contact channels, from configuration only. A channel renders only
 * when its variable is set; nothing is invented. The owner supplies values.
 */
const clean = (v: string | undefined) => (v ?? "").trim();

export const contact = {
  phone: clean(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  whatsapp: clean(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP),
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  address: clean(process.env.NEXT_PUBLIC_CONTACT_ADDRESS),
  hours: clean(process.env.NEXT_PUBLIC_CONTACT_HOURS),
};

export const hasDirectChannel = Boolean(
  contact.phone || contact.whatsapp || contact.email,
);

export function telHref(number: string) {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(number: string, message: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
