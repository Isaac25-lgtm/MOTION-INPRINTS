// Launch validation for the Motion Imprints parent site.
//
// Development builds may serve genuine photographs whose publication
// permission is still pending. A public launch may not. This script lists
// every blocker and exits 1 while any remain, so it can gate a deploy:
//
//   npm run launch:check -w motion-imprints
//
// With --photos it checks only the photograph permissions. The Render build
// runs that mode (npm run check:photos) before building, so a deploy fails
// while any served photograph is still pending, whatever else is configured.
//
// It never treats "pending" as approved. To clear an image, the owner confirms
// permission and its manifest row is changed to permission "approved" and
// publication "launch-approved" (or the image is removed from the site).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(join(appRoot, "content/asset-manifest.json"), "utf8"),
);

const photosOnly = process.argv.includes("--photos");
const blockers = [];

// 1. Every genuine photograph the site serves needs confirmed permission.
const served = manifest.filter((row) => row.public_derivatives.length > 0);
const pending = served.filter(
  (row) =>
    row.permission !== "approved" || row.publication !== "launch-approved",
);
for (const row of pending) {
  const where = [
    ...new Set(
      row.public_derivatives.map((f) => f.split("/").slice(0, 4).join("/")),
    ),
  ].join(", ");
  blockers.push(
    `image ${row.original_filename}: permission "${row.permission}", publication "${row.publication}" (served from ${where})`,
  );
}

// 2. Production configuration must be real, not the local defaults.
if (!photosOnly) {
  const env = process.env;
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!/^https:\/\//.test(siteUrl) || /localhost/.test(siteUrl))
    blockers.push("NEXT_PUBLIC_SITE_URL is not a public https domain");
  const techUrl = env.NEXT_PUBLIC_TECHNOLOGIES_URL ?? "";
  if (!/^https:\/\//.test(techUrl) || /localhost/.test(techUrl))
    blockers.push("NEXT_PUBLIC_TECHNOLOGIES_URL is not a public https domain");
  if (!env.NEXT_PUBLIC_CONTACT_PHONE && !env.NEXT_PUBLIC_CONTACT_EMAIL)
    blockers.push(
      "no verified public contact channel (NEXT_PUBLIC_CONTACT_PHONE or NEXT_PUBLIC_CONTACT_EMAIL)",
    );
  if (env.ALLOW_INDEXING !== "true")
    blockers.push(
      "ALLOW_INDEXING is not true; search engines are told to stay out",
    );
  if (!env.DATABASE_URL)
    blockers.push("DATABASE_URL is not set; quote requests cannot be stored");
}

console.log(
  `Launch check: ${served.length} served originals, ${pending.length} pending permission.`,
);
if (blockers.length) {
  console.log(`\n${blockers.length} blocker(s):`);
  for (const b of blockers) console.log(`  - ${b}`);
  if (photosOnly)
    console.log(
      "\nDeploy stopped. Approve each photograph in content/asset-manifest.json" +
        ' (permission "approved", publication "launch-approved") or remove it from the site.',
    );
  process.exitCode = 1;
} else {
  console.log(
    photosOnly ? "All served photographs are approved." : "No launch blockers.",
  );
}
