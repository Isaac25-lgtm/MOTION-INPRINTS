import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${site.name} handles the information you send through this website.`,
  alternates: { canonical: "/privacy" },
};

/**
 * Describes only what this website actually does. The owner should review it
 * and add the company's registered details and a contact for data requests
 * once confirmed.
 */
export default function PrivacyPage() {
  return (
    <article className="interior">
      <Breadcrumbs items={[{ label: "Privacy" }]} />
      <h1 className="display" style={{ marginTop: 24 }}>
        Privacy
      </h1>
      <div className="interior__body">
        <p>
          This page explains what information this website collects and how it
          is used.
        </p>
        <h2>What stays in your browser</h2>
        <p>
          Your quote list (the products, options, quantities and notes you add)
          is kept in your own browser so it survives a refresh. It holds no
          name, phone number or email. If you arrived from a campaign link, its
          campaign tags are kept for that visit only.
        </p>
        <h2>What you send us</h2>
        <ul>
          <li>
            A quote request or message: your name, phone, optional email and
            WhatsApp number, town, dates and notes, and the items on your list.
          </li>
          <li>
            If you use the assistant and choose to talk to a person: a short
            summary you approve and the contact details you give. The
            conversation itself is not stored.
          </li>
        </ul>
        <h2>What we do not collect</h2>
        <p>
          No advertising or tracking cookies, no third-party analytics scripts,
          no account or password, and no payment details: nothing is paid
          online.
        </p>
        <h2>How it is used</h2>
        <p>
          Only to reply to your request and keep a record of it. We do not sell
          it or share it for marketing.
        </p>
        <h2>Your choices</h2>
        <p>
          You can clear the quote list at any time. To see, correct or delete
          what you sent, contact us through this website and quote your
          reference.
        </p>
      </div>
    </article>
  );
}
