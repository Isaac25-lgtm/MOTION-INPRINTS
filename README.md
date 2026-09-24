# Motion Imprints websites

Two independent Next.js sites in one npm workspace. Each deploys as its own Render
web service with its own domain; both share one Neon PostgreSQL database.

| Site | Package | Local URL |
| --- | --- | --- |
| Motion Imprints | `apps/motion-imprints` | http://localhost:3000 |
| Motion Imprints Technologies | `apps/motion-technologies` | http://localhost:3001 |

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev:imprints    # port 3000
npm run dev:tech        # port 3001
```

Each app's `.env.example` lists its settings. Copy it to `.env.local` to override
the localhost defaults. Never commit real secrets.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment: Render and Neon

`render.yaml` is a Render Blueprint that creates **two separate web services** from
this repository:

| Render service | Builds | Its own domain |
| --- | --- | --- |
| `motion-imprints` | `apps/motion-imprints` | The Motion Imprints domain |
| `motion-technologies` | `apps/motion-technologies` | The Technologies domain |

Each service scales, restarts and redeploys on its own. Both use the **same** Neon
database. The `inquiries` table records which site each message came from.

### Steps

1. **Create the services.** In Render, choose **New → Blueprint** and pick this
   repository. Render asks for four addresses: each site's own address and the other
   site's address. Until the domains are connected, use the `onrender.com` addresses
   (for example `https://motion-imprints.onrender.com`). Everything else below is
   added later in each service's **Environment** tab, when you have it.

   Settings whose names start with `NEXT_PUBLIC_` are built into the pages, so after
   changing one, redeploy the service (**Manual Deploy → Deploy latest commit**).
2. **Set up the database.** Create a Neon project and run the migration once with the
   **direct** connection string:
   ```bash
   DATABASE_URL="<direct connection string>" npm run db:migrate
   ```
   Then add the **pooled** connection string as `DATABASE_URL` in the Environment tab
   of **both** services. It goes only into Render, never into this repository.
3. **Connect the domains.** Add each custom domain in that service's Render settings,
   then change:
   - `motion-imprints`: `NEXT_PUBLIC_SITE_URL` (its own domain) and
     `NEXT_PUBLIC_TECHNOLOGIES_URL` (the Technologies domain)
   - `motion-technologies`: `NEXT_PUBLIC_SITE_URL` (its own domain) and
     `NEXT_PUBLIC_PARENT_URL` (the Motion Imprints domain)
4. **Add contact details.** Add the `NEXT_PUBLIC_CONTACT_*` values on both services.
   Each channel appears only when it is set.
5. **Optional extras:**
   - `MOTION_ASSISTANT_API_KEY` turns on live answers from the Ask Motion assistant.
     Without it, visitors can still use "Talk to a person".
   - `NOTIFY_WEBHOOK_URL` sends staff a notification for each new request.
6. **Check before going public.** Run `npm run launch:check -w motion-imprints` and
   `npm run launch:check -w motion-technologies`. Both must report no blockers.
7. **Allow search engines.** Only after step 6 passes, change `ALLOW_INDEXING` to
   `true` on both services. It is set to `false` in `render.yaml`, so change it there
   too, or the next Blueprint sync will set it back.
