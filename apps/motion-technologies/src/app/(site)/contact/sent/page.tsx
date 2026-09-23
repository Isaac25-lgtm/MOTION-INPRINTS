import type { Metadata } from "next";
import Link from "next/link";
import { contact, telHref, whatsappHref } from "@/lib/contact";
import { REFERENCE_PATTERN } from "@/lib/leads/reference";

export const metadata: Metadata = {
  title: "Inquiry received",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SentPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const reference =
    typeof ref === "string" && REFERENCE_PATTERN.test(ref) ? ref : null;
  return (
    <div className="container confirm">
      <p className="kicker">Inquiry received</p>
      <h1 className="plain__title">Thank you. We will be in touch.</h1>
      {reference ? (
        <p className="confirm__ref">
          Your reference is <strong>{reference}</strong>.
        </p>
      ) : null}
      <p className="lede">
        We reply on the number you gave, usually to arrange a first conversation
        about the work.
      </p>
      {contact.whatsapp || contact.phone ? (
        <div className="actions" style={{ marginTop: 24 }}>
          {contact.whatsapp ? (
            <a
              className="btn btn--dark"
              href={whatsappHref(
                contact.whatsapp,
                `Hello Motion Imprints Technologies, about my inquiry${reference ? ` ${reference}` : ""}: `,
              )}
            >
              WhatsApp Us
            </a>
          ) : null}
          {contact.phone ? (
            <a className="btn btn--line-dark" href={telHref(contact.phone)}>
              Call {contact.phone}
            </a>
          ) : null}
        </div>
      ) : null}
      <p className="confirm__more">
        <Link className="more" href="/solutions">
          Keep exploring solutions <span aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}
