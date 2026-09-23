import type { ReactNode } from "react";
import { Assistant } from "@/components/assistant/Assistant";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LandingCapture } from "@/components/leads/LandingCapture";
import { assistantConfigured } from "@/lib/assistant/provider";
import { contact, whatsappHref } from "@/lib/contact";
import "@/styles/pages.css";
import "@/styles/forms.css";
import "@/styles/assistant.css";

const suggestions = [
  "What can you build for a clinic?",
  "How would an M&E platform work for our programme?",
  "We just opened a shop. Where do we start?",
  "Can your systems connect to DHIS2?",
];

/** Shared, server-rendered shell for every Technologies route. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="site-main">
        {children}
      </main>
      <Footer />
      <LandingCapture />
      <Assistant
        available={assistantConfigured()}
        subtitle="Motion Imprints Technologies · AI assistant"
        suggestions={suggestions}
        linkPrefixes={[
          "/solutions",
          "/capabilities",
          "/contact",
          "/work",
          "/about",
        ]}
        whatsappHref={
          contact.whatsapp
            ? whatsappHref(
                contact.whatsapp,
                "Hello Motion Imprints Technologies, ",
              )
            : undefined
        }
      />
    </>
  );
}
