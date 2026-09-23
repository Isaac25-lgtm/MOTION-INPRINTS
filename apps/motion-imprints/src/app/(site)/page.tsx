import type { Metadata } from "next";
import {
  CapabilityRail,
  ClosingCta,
  FeaturedProject,
  Hero,
  ProcessSteps,
  SelectedWork,
  ServiceGrid,
} from "@/components/home/HomeSections";
import { defaultOgImages } from "@/lib/og";
import { site } from "@/lib/site";
import "@/styles/home.css";

export const metadata: Metadata = {
  title: "Design, print and production in one place",
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Motion Imprints — Design, print and production",
    description: site.description,
    images: defaultOgImages,
  },
};

// Only facts that are confirmed: name, address of the site and the logo.
// Contact points are added when the owner supplies them.
const organisation = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/brand/logo-trim.png`,
  description: site.description,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation) }}
      />
      <Hero />
      <CapabilityRail />
      <ServiceGrid />
      <FeaturedProject />
      <SelectedWork />
      <ProcessSteps />
      <ClosingCta />
    </>
  );
}
