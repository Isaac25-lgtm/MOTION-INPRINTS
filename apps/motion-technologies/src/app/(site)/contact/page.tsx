import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/LeadForm";
import { Crumbs } from "@/components/Sections";
import { getSolution, solutions } from "@/content/solutions";
import {
  contact,
  hasDirectChannel,
  telHref,
  whatsappHref,
} from "@/lib/contact";
import { site } from "@/lib/site";

const description =
  "Discuss a system, request a demonstration or ask for a quotation from Motion Imprints Technologies.";

export const metadata: Metadata = {
  title: "Discuss a project",
  description,
  alternates: { canonical: "/contact" },
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const next = [
  "We read your message and reply on the number you give.",
  "A first call to understand the work, the people and the constraints.",
  "A written proposal with scope, stages and costs for you to review.",
];

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const solution =
    typeof params.solution === "string" ? getSolution(params.solution) : null;
  const type =
    params.type === "demo" || params.type === "quote" ? params.type : "discuss";

  const waText = solution
    ? `Hello Motion Imprints Technologies, I would like to discuss ${solution.name.toLowerCase()}.`
    : "Hello Motion Imprints Technologies, I would like to discuss a project.";

  return (
    <div className="container contact">
      <Crumbs items={[{ label: "Contact" }]} />
      <div className="contact__grid">
        <div>
          <p className="kicker">
            {solution ? solution.name : "Project inquiry"}
          </p>
          <h1 className="contact__title">
            {solution ? solution.cta : "Discuss a project"}
          </h1>
          <p className="lede">
            A few details are enough to start. We will ask the rest in
            conversation.
          </p>
          <LeadForm
            solutions={solutions.map((s) => ({ value: s.slug, label: s.name }))}
            initialSolution={solution?.slug ?? "general"}
            initialType={type}
          />
        </div>
        <aside className="contact__aside" aria-label="Other ways to reach us">
          {hasDirectChannel ? (
            <div className="contact__card">
              <p className="kicker">Talk to us directly</p>
              <ul className="contact__channels">
                {contact.whatsapp ? (
                  <li>
                    <a href={whatsappHref(contact.whatsapp, waText)}>
                      <span>WhatsApp</span>
                      {contact.whatsapp}
                    </a>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li>
                    <a href={telHref(contact.phone)}>
                      <span>Call</span>
                      {contact.phone}
                    </a>
                  </li>
                ) : null}
                {contact.email ? (
                  <li>
                    <a href={`mailto:${contact.email}`}>
                      <span>Email</span>
                      {contact.email}
                    </a>
                  </li>
                ) : null}
              </ul>
              {contact.address ? <p>{contact.address}</p> : null}
              {contact.hours ? <p>{contact.hours}</p> : null}
            </div>
          ) : null}
          <div className="contact__card">
            <p className="kicker">What happens next</p>
            <ol className="contact__steps">
              {next.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ol>
          </div>
          <div className="contact__card contact__card--navy dark">
            <p className="kicker">Print, signage or branding?</p>
            <p>Those are made by {site.parentName}, our parent company.</p>
            <a className="more" href={`${site.parentUrl}/contact`}>
              Contact {site.parentName} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
