import type { Metadata } from "next";
import { defaultOgImages } from "@/lib/og";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactForm } from "@/components/quote/ContactForm";
import { getProduct } from "@/content/catalogue";
import {
  contact,
  hasDirectChannel,
  telHref,
  whatsappHref,
} from "@/lib/contact";
import { getService, services } from "@/lib/nav";
import { site } from "@/lib/site";

const description =
  "Tell Motion Imprints what you need designed, printed, branded or installed. Send a message or request a quotation.";

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact — Motion Imprints",
    description,
    images: defaultOgImages,
  },
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const topics = [
  { value: "general", label: "A new project or general question" },
  ...services.map((s) => ({ value: s.slug, label: s.title })),
  { value: "product", label: "A product in the catalogue" },
  { value: "feedback", label: "Feedback about our work or this website" },
];

const nextSteps = [
  "We read your message and reply on the number you give.",
  "If we need sizes, quantities or artwork, we ask.",
  "You receive a quotation to approve before anything is made.",
];

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const service =
    typeof params.service === "string" ? getService(params.service) : null;
  const product =
    typeof params.product === "string" ? getProduct(params.product) : null;

  let topic = "general";
  let message = "";
  let subject = "";
  if (product) {
    topic = "product";
    subject = `Product: ${product.title}`;
    message = `I would like a quotation for ${product.title.toLowerCase()}.\n\nQuantity: \nDetails: `;
  } else if (service) {
    topic = service.slug;
    subject = `Service: ${service.title}`;
    message = `I would like to discuss ${service.title.toLowerCase()}.\n\n`;
  }

  const waMessage = product
    ? `Hello Motion Imprints, I would like a quotation for ${product.title.toLowerCase()}.`
    : service
      ? `Hello Motion Imprints, I would like to discuss ${service.title.toLowerCase()}.`
      : "Hello Motion Imprints, I would like to discuss a project.";

  return (
    <div className="container contact">
      <Breadcrumbs items={[{ label: "Contact" }]} />
      <div className="contact__grid">
        <div>
          <h1 className="display contact__title">Tell us what you need</h1>
          <p className="lede">
            Describe the job in your own words. Sizes, quantities and a date
            help, but a rough idea is enough to start.
          </p>
          {product ? (
            <p className="contact__context">
              About: <strong>{product.title}</strong>.{" "}
              <Link href={`/products/${product.slug}`}>Back to product</Link>
            </p>
          ) : null}
          <ContactForm
            topics={topics}
            initialTopic={topic}
            initialMessage={message}
            subject={subject}
          />
        </div>

        <aside className="contact__aside" aria-label="Other ways to reach us">
          {hasDirectChannel ? (
            <div className="contact__card">
              <h2 className="eyebrow">Talk to us directly</h2>
              <ul className="contact__channels">
                {contact.whatsapp ? (
                  <li>
                    <a href={whatsappHref(contact.whatsapp, waMessage)}>
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
              {contact.address ? (
                <p className="contact__address">
                  {contact.address}
                  {contact.mapUrl ? (
                    <>
                      {" "}
                      <a href={contact.mapUrl}>Map ↗</a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {contact.hours ? (
                <p className="contact__hours">{contact.hours}</p>
              ) : null}
            </div>
          ) : null}

          <div className="contact__card">
            <h2 className="eyebrow">What happens next</h2>
            <ol className="contact__steps">
              {nextSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="contact__card contact__card--quiet">
            <h2 className="eyebrow">Know exactly what you want?</h2>
            <p>
              Build a list from the catalogue and send it as one quote request.
            </p>
            <Link className="textlink" href="/products">
              Browse products <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="contact__card contact__card--dark">
            <h2 className="eyebrow eyebrow--light">
              Software, websites or digital marketing?
            </h2>
            <p>
              {site.technologiesName} sets up systems, point of sale, websites
              and digital marketing.
            </p>
            <a className="textlink" href={site.technologiesUrl}>
              Visit Technologies <span aria-hidden="true">↗</span>
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
