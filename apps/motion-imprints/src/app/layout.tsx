import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight } from "next/font/google";
import { defaultOgImages } from "@/lib/og";
import { site } from "@/lib/site";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
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
