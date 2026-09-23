import type { Metadata } from "next";
import { Crumbs } from "@/components/Sections";
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
    <>
      <Crumbs items={[{ label: "Privacy" }]} />
      <div className="container plain">
        <h1 className="plain__title">Privacy</h1>
        <div className="prose">
          <p>
            This page explains what information this website collects and how it
            is used. It covers the website only, not systems we build for
            clients, which have their own agreements.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>
              What you type into the inquiry form: name, organisation, phone,
              optional email and WhatsApp number, optional role and town, your
              message and your choices on the form.
            </li>
            <li>
              If you arrived from a campaign link, the campaign tags in that
              link and the website that referred you, sent with your inquiry.
            </li>
            <li>
              If you use the assistant and choose to ask for a person, a short
              summary you approve and the contact details you give.
            </li>
          </ul>
          <h2>What we do not collect</h2>
          <p>
            No advertising or tracking cookies, no third-party analytics scripts
            and no account or password. Please do not send patient, member,
            student or other confidential records through the website.
          </p>
          <h2>How it is used</h2>
          <p>
            Only to reply to your inquiry and to keep a record of it. We do not
            sell it or share it for marketing.
          </p>
          <h2>Where it is kept</h2>
          <p>
            In the database behind this website, reachable only by the server
            and by staff who handle inquiries. Connections are encrypted.
          </p>
          <h2>Your choices</h2>
          <p>
            You can ask us to show, correct or delete the information you sent
            by contacting us through this website and quoting your reference.
          </p>
        </div>
      </div>
    </>
  );
}
