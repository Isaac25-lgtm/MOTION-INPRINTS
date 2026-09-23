import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { contact } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Your quote list",
  description: "Review your quote list and send it to Motion Imprints.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/quote" },
};

export default function QuotePage() {
  return (
    <div className="container quote-page">
      <Breadcrumbs items={[{ label: "Quote list" }]} />
      <h1 className="display quote-page__title">Your quote list</h1>
      <p className="lede">
        Check quantities and notes, add your details and send. We reply with a
        quotation or any questions. Nothing is charged online.
      </p>
      <QuoteBuilder
        channels={{
          phone: contact.phone,
          whatsapp: contact.whatsapp,
          email: contact.email,
        }}
      />
    </div>
  );
}
