import type { Metadata } from "next";
import {
  Crumbs,
  CtaBand,
  NumberedTitle,
  PageBanner,
} from "@/components/Sections";
import { Img } from "@/components/media/Img";
import { device, photo } from "@/content/media";

const description =
  "How Motion Imprints Technologies connects systems to survey tools, national reporting formats, payments, messaging, spreadsheets and existing databases, only where authorised.";

export const metadata: Metadata = {
  title: "Integrations",
  description,
  alternates: { canonical: "/capabilities/integrations" },
};

const kinds = [
  {
    title: "Survey and field tools",
    examples: "KoboToolbox, ODK",
    text: "Submissions pulled on a schedule through the tools' own interfaces, using your project's credentials.",
  },
  {
    title: "National reporting",
    examples: "DHIS2, eHMIS",
    text: "Reports shaped to national formats, and automated exchange where your facility or programme is authorised to connect. We never assume or imply access.",
  },
  {
    title: "Health data standards",
    examples: "HL7 FHIR",
    text: "Structured exchange with other clinical systems where a project requires it.",
  },
  {
    title: "Payments",
    examples: "Mobile money, bank references",
    text: "Payment references reconciled against records. Direct collection depends on an agreement with the provider.",
  },
  {
    title: "Messaging",
    examples: "SMS, email, WhatsApp",
    text: "Reminders and alerts sent through providers you have an account with.",
  },
  {
    title: "Files and existing data",
    examples: "Excel, CSV, databases",
    text: "Imports during migration, scheduled exports, and connections to databases you already run.",
  },
];

const steps = [
  {
    title: "Map the flow",
    text: "Which data moves, in which direction, how often, and who owns it.",
  },
  {
    title: "Agree access",
    text: "Credentials and permissions come from the owner of each system, in writing.",
  },
  {
    title: "Build and test",
    text: "The link is built against test data first, with failures logged and visible.",
  },
  {
    title: "Document and hand over",
    text: "Every connection is written down so it can be maintained later.",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <Crumbs items={[{ label: "Capabilities" }, { label: "Integrations" }]} />
      <PageBanner
        title="Built to connect"
        lede="A new system should not become another island. We connect it to the tools and reporting duties you already have, where you are authorised to connect."
        img={photo("connected")}
        position="50% 40%"
      />

      <section className="section container intro" aria-labelledby="flow">
        <div className="intro__media">
          <Img
            img={device("phone-field")}
            sizes="(min-width: 901px) 55vw, 100vw"
            position="55% 45%"
          />
        </div>
        <div className="intro__copy">
          <NumberedTitle n={1} id="flow">
            From the field to the report
          </NumberedTitle>
          <p>
            Data captured on a phone in the field, offline if needed, arrives in
            the same system managers report from. No re-typing, no email
            attachments, no second spreadsheet.
          </p>
          <p className="featured__note">
            On screen: our design, with invented sample data.
          </p>
        </div>
      </section>

      <section className="section container block" aria-labelledby="kinds">
        <NumberedTitle n={2} id="kinds">
          What we connect to
        </NumberedTitle>
        <p className="kicker block__kicker">
          Common tools, not partnerships or endorsements
        </p>
        <ul className="modules">
          {kinds.map((k) => (
            <li key={k.title}>
              <p className="kicker">{k.examples}</p>
              <h3 style={{ marginTop: 8 }}>{k.title}</h3>
              <p>{k.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section container block" aria-labelledby="how">
        <NumberedTitle n={3} id="how">
          Authorised, tested and written down
        </NumberedTitle>
        <p className="kicker block__kicker">How we do it</p>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="steps__num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mission" aria-labelledby="never">
        <h2 id="never" className="title">
          What we will not do
        </h2>
        <p>
          Connect to any system without its owner&apos;s permission, copy data
          by scraping screens, or keep credentials anywhere but secure server
          configuration.
        </p>
      </section>

      <div style={{ height: "var(--section)" }} />
      <CtaBand
        title="Have systems that should talk to each other?"
        text="List what you use today and what should move between them. We will tell you what is realistic."
        img={photo("closing")}
        href="/contact?solution=custom-software"
        label="Discuss integration"
      />
    </>
  );
}
