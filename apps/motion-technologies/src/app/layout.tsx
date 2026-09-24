import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { indexingAllowed, site } from "@/lib/site";
import "./globals.css";

// Fonts ship with the site (SIL Open Font License, see src/fonts) so a build
// never depends on reaching Google Fonts. Latin subset, variable weight.
const montserrat = localFont({
  src: "../fonts/Montserrat-latin.woff2",
  weight: "400 700",
  variable: "--font-montserrat",
  display: "swap",
});

const mono = localFont({
  src: "../fonts/JetBrainsMono-latin.woff2",
  weight: "400 500",
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  metadataBase: new URL(site.url),
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_UG",
    images: [
      {
        url: "/og/technologies.jpg",
        width: 1200,
        height: 630,
        alt: "Motion Imprints Technologies: systems built around real work.",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  robots: indexingAllowed ? undefined : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
