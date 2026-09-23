import type { Metadata } from "next";
import Link from "next/link";
import { REFERENCE_PATTERN } from "@/lib/quote/reference";
import { contact, telHref, whatsappHref } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Request received",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Confirmation after a successful server write. The reference comes from the
 *  server's 201 response; anything malformed is not echoed back. */
export default async function QuoteSentPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const reference =
    typeof ref === "string" && REFERENCE_PATTERN.test(ref) ? ref : null;

  return (
    <div className="container confirm">
      <p className="eyebrow">Request received</p>
      <h1 className="display">Thank you. Your request is with us.</h1>
      {reference ? (
        <p className="confirm__ref">
          Your reference is <strong>{reference}</strong>. Please quote it if you
          contact us about this request.
        </p>
      ) : null}
      <p className="lede">
        We will reply on the number you gave, with a quotation or any questions
        about sizes, quantities or artwork.
      </p>
      {contact.whatsapp || contact.phone ? (
        <div className="confirm__direct">
          <p>Need to add something or talk it through?</p>
          <div className="actions">
            {contact.whatsapp ? (
              <a
                className="btn btn--solid"
                href={whatsappHref(
                  contact.whatsapp,
                  `Hello Motion Imprints, about my quote request${reference ? ` ${reference}` : ""}: `,
                )}
              >
                WhatsApp Us
              </a>
            ) : null}
            {contact.phone ? (
              <a className="btn btn--ghost" href={telHref(contact.phone)}>
                Call {contact.phone}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <p className="confirm__more">
        <Link className="textlink" href="/products">
          Keep browsing products <span aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}
