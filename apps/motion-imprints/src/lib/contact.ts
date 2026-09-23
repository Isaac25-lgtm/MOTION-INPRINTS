/**
 * Public contact channels, from configuration only.
 *
 * Nothing here is invented: a channel renders only when its variable is set.
 * The owner supplies the real values (see .env.example). Until then the site
 * shows the forms and no phone, WhatsApp or email.
 */
const clean = (v: string | undefined) => (v ?? "").trim();

export const contact = {
  phone: clean(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  whatsapp: clean(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP),
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  address: clean(process.env.NEXT_PUBLIC_CONTACT_ADDRESS),
  hours: clean(process.env.NEXT_PUBLIC_CONTACT_HOURS),
  mapUrl: clean(process.env.NEXT_PUBLIC_CONTACT_MAP_URL),
};

export const hasDirectChannel = Boolean(
  contact.phone || contact.whatsapp || contact.email,
);

/** tel: link from a display number with spaces or dashes. */
export function telHref(number: string) {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

/** wa.me link with an editable prefilled message. */
export function whatsappHref(number: string, message: string) {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
