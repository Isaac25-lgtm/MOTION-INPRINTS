import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Montserrat } from "next/font/google";
import { indexingAllowed, site } from "@/lib/site";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
