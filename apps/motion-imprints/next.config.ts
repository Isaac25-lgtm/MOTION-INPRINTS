import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/**
 * Baseline security headers (handoff §19.1). The content security policy is
 * applied to production builds only: the development server needs eval and
 * websockets for hot reload. Inline scripts and styles are allowed because
 * Next.js inlines its bootstrap data and the structured-data block; nothing
 * is loaded from another origin (fonts are self-hosted by next/font).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(production
    ? [
        { key: "Content-Security-Policy", value: csp },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Independent Render web service for the parent site.
  poweredByHeader: false,
  // The existing .next directory is owned by a sandbox identity and cannot be
  // replaced by the current user. Production output lives in build/.
  distDir: "build",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
