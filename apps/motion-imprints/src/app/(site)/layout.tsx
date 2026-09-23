import type { ReactNode } from "react";
import { Assistant } from "@/components/assistant/Assistant";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LandingCapture } from "@/components/quote/LandingCapture";
import { assistantConfigured } from "@/lib/assistant/provider";
import { contact, whatsappHref } from "@/lib/contact";
import "@/styles/pages.css";
import "@/styles/shop.css";
import "@/styles/assistant.css";

const suggestions = [
  "What do I need for a new shop front?",
  "Printed or embroidered polo shirts?",
  "How does the quote list work?",
  "What should I send for business cards?",
];

/** Shared, server-rendered shell for every regular parent-site route. */
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
        subtitle="Motion Imprints · AI assistant"
        suggestions={suggestions}
        linkPrefixes={[
          "/services",
          "/products",
          "/work",
          "/quote",
          "/contact",
          "/about",
        ]}
        whatsappHref={
          contact.whatsapp
            ? whatsappHref(contact.whatsapp, "Hello Motion Imprints, ")
            : undefined
        }
      />
    </>
  );
}
