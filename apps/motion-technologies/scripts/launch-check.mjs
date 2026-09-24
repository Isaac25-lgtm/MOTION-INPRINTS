// Launch validation for the Technologies site. Lists every blocker and exits 1
// while any remain:  npm run launch:check -w motion-technologies
//
// Imagery here is licensed stock and our own screen designs (no permission
// blockers); the checks are configuration.
const env = process.env;
const blockers = [];
const https = (v) => /^https:\/\//.test(v ?? "") && !/localhost/.test(v ?? "");

if (!https(env.NEXT_PUBLIC_SITE_URL))
  blockers.push("NEXT_PUBLIC_SITE_URL is not a public https domain");
if (!env.NEXT_PUBLIC_CONTACT_PHONE && !env.NEXT_PUBLIC_CONTACT_EMAIL)
  blockers.push(
    "no verified public contact channel (NEXT_PUBLIC_CONTACT_PHONE or NEXT_PUBLIC_CONTACT_EMAIL)",
  );
if (env.ALLOW_INDEXING !== "true")
  blockers.push(
    "ALLOW_INDEXING is not true; search engines are told to stay out",
  );
if (!env.DATABASE_URL)
  blockers.push("DATABASE_URL is not set; inquiries cannot be stored");

const notes = [];
if (!env.MOTION_ASSISTANT_API_KEY)
  notes.push(
    "MOTION_ASSISTANT_API_KEY not set: the assistant will offer handoff only",
  );

if (blockers.length) {
  console.log(`${blockers.length} blocker(s):`);
  for (const b of blockers) console.log(`  - ${b}`);
  process.exitCode = 1;
} else {
  console.log("No launch blockers.");
}
for (const n of notes) console.log(`note: ${n}`);
