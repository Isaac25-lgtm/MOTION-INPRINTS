import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { defaultOgImages } from "@/lib/og";
import { site } from "@/lib/site";
import "./globals.css";

// Fonts ship with the site (SIL Open Font License, see src/fonts) so a build
// never depends on reaching Google Fonts. Latin subset, variable weight.
const interTight = localFont({
  src: "../fonts/InterTight-latin.woff2",
  weight: "600 700",
  variable: "--font-display-src",
  display: "swap",
});

const inter = localFont({
  src: "../fonts/Inter-latin.woff2",
  weight: "400 600",
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  metadataBase: new URL(site.url),
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_UG",
    images: defaultOgImages,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${interTight.variable} ${inter.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
