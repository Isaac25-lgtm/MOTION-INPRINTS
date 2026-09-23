import type { Metadata } from "next";
import Link from "next/link";
import {
  Crumbs,
  CtaBand,
  NumberedTitle,
  PageBanner,
} from "@/components/Sections";
import { Img } from "@/components/media/Img";
import { device, photo } from "@/content/media";

const description =
  "Concept demonstrations from Motion Imprints Technologies, each labelled for what it is and built with invented data.";

export const metadata: Metadata = {
  title: "Work and demonstrations",
  description,
  alternates: { canonical: "/work" },
};

/**
 * Every item is labelled with its real status. Today all of them are concept
 * demonstrations with invented data. Approved client work is added only with
 * the client's permission, labelled "Client project".
 */
const demos: {
  title: string;
  shot: string;
  status: "Concept demonstration";
  text: string;
  solution: string;
}[] = [
  {
    title: "M&E results platform",
    shot: "laptop-me",
    status: "Concept demonstration",
    text: "A results framework with indicators, progress against targets, district coverage and data-quality flags, showing how programme data can flow from collection to report.",
    solution: "monitoring-evaluation",
  },
  {
    title: "Field data collection",
    shot: "phone-field",
    status: "Concept demonstration",
    text: "A household survey form on a phone that saves offline and captures location, feeding the same results framework.",
    solution: "monitoring-evaluation",
  },
  {
    title: "Outpatient flow",
    shot: "laptop-health",
    status: "Concept demonstration",
    text: "A facility queue from registration to pharmacy, with an encounter panel for vitals and orders. Patients are identified by invented codes only.",
    solution: "health",
  },
  {
    title: "SACCO loans pipeline",
    shot: "laptop-sacco",
    status: "Concept demonstration",
    text: "Loan applications moving from appraisal to approval, with the trail that shows who acted and when.",
    solution: "sacco",
  },
  {
    title: "A shop's day on a phone",
    shot: "phone-shop",
    status: "Concept demonstration",
    text: "Sales so far, branch totals and what needs attention, for an owner who is not at the counter.",
    solution: "pos-retail",
  },
  {
    title: "Launch plan for a new business",
    shot: "laptop-marketing",
    status: "Concept demonstration",
    text: "A first week of content, the profiles to set up, and a simple view from reach to enquiries.",
    solution: "digital-marketing",
  },
];

export default function WorkPage() {
  return (
    <>
      <Crumbs items={[{ label: "Work" }]} />
      <PageBanner
        title="Work and demonstrations"
        lede="Concept demonstrations with invented data, built to show how a system can work. Client projects will appear here only with the client's permission, clearly marked."
        img={photo("real-work")}
        position="50% 40%"
      />
      <section className="section container" aria-label="Demonstrations">
        <ol className="sol-rows">
          {demos.map((d, i) => (
            <li className="sol-row" key={d.title}>
              <div className="sol-row__media">
                <Img
                  img={device(d.shot)}
                  sizes="(min-width: 901px) 45vw, 100vw"
                />
              </div>
              <div className="sol-row__copy">
                <p className="status-tag">{d.status}</p>
                <NumberedTitle n={i + 1}>{d.title}</NumberedTitle>
                <p>{d.text}</p>
                <Link
                  className="more"
                  href={`/contact?solution=${d.solution}&type=demo`}
                >
                  Discuss a similar project
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <CtaBand
        title="Want to see one working?"
        text="We can walk you through a demonstration and discuss how it would change for your organisation."
        img={photo("closing")}
        href="/contact?type=demo"
        label="Request a demonstration"
      />
    </>
  );
}
