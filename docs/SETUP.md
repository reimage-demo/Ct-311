# Cloudflare setup

Use a dedicated demo account/environment and synthetic data. No Cloudflare resources were created remotely during the rewrite. Existing GitHub Pages hosting remains a nonfunctional preview of backend features.

## 1. Runtime and resources

Use Node >=22. Install dependencies with `npm ci`. Authenticate using `npx wrangler login` in your own browser. Use least-privilege Cloudflare deployment credentials for CI; never expose them in a frontend environment or commit them.

Create the resources:

```sh
npx wrangler d1 create hartford-311
npx wrangler r2 bucket create hartford-311-private-photos
```

Replace the placeholder `database_id` in `wrangler.jsonc` with the created D1 UUID. Keep the R2 bucket private: **do not enable r2.dev, a public custom domain, or anonymous access**. Enable Cloudflare Images transformations for the IMAGES binding. Images is an additional Cloudflare product/usage charge, not a separate vendor; it replaces native Sharp in the deployed Worker.

Durable Objects are configured with SQLite storage and created by the deployment migration. Their only purpose is distributed rate limiting; the namespace has no public URL.

Apply D1 migrations:

```sh
npm run db:migrate:local
npm run db:migrate:remote
```

The remote command is for the isolated deployment you selected. Use distinct database/bucket/Worker names for staging and any future official service. Do not reuse the demo's data or secrets for production.

## 2. One application origin

Choose a hostname on a Cloudflare-managed domain, such as `311-demo.example.com`. Add its Worker custom-domain route to `wrangler.jsonc`:

```json
"routes": [{"pattern":"311-demo.example.com","custom_domain":true}]
```

Set `APP_ORIGIN` to exactly `https://311-demo.example.com`, without a trailing slash. Both the public pages and APIs run on this origin. CORS does not permit cross-origin writes, so the GitHub Pages preview cannot submit into the backend. `workers_dev` and deployment-preview URLs are disabled to eliminate alternate ingress paths. Do not enable an unprotected alternate route.

## 3. Access and MFA

In Cloudflare Zero Trust, create a self-hosted Access application covering ALL of these paths on the chosen hostname, using the same application audience:

- `/admin` and `/admin/*`
- `/api/staff/*`
- `/api/photo/*`

Use explicit invited-user/email/group allowlists. Require MFA through your organizational identity provider or Access independent MFA. Do not use an Everyone allow rule, bypass policy, or service-token authentication for these staff endpoints. An email one-time PIN by itself does not meet the MFA requirement. Confirm the MFA challenge cannot be skipped with a fresh browser session.

Set `ACCESS_TEAM_DOMAIN` to the exact `https://your-team.cloudflareaccess.com` issuer and `ACCESS_AUD` to this Access application's audience. The Worker verifies RS256 signature, issuer, audience, expiry, issued-at presence, subject, application-token type and email claim. It then checks active D1 membership on every request. Never trust an email header alone. MFA policy enforcement is an Access configuration requirement; the Worker cannot configure or certify that account setting.

## 4. Bootstrap the first administrator

After the invited administrator authenticates through Access, obtain their verified Access subject ID from the administrator-controlled Access user/session information. Do not substitute an unverified browser-provided email or subject.

```sh
node scripts/bootstrap-admin.mjs VERIFIED_ACCESS_SUBJECT
```

Review the generated `load/results/bootstrap.sql`. Apply it with `npx wrangler d1 execute hartford-311 --remote --file=load/results/bootstrap.sql`. It inserts only when there are no staff memberships and creates an audit event via the database trigger. This is an operator-only SQL procedure; there is no remotely callable bootstrap endpoint. Add other members through `/admin/team` after allowing them in Access.

Membership subjects are immutable. To change an identity, disable the old member and add a new one. A staff edit includes its expected version; refresh after a conflict. Admins cannot disable/demote/rebind themselves. Access dashboard users and application staff memberships are different concepts.

## 5. Secrets, maps and bot verification

Set Worker secrets through Wrangler's interactive prompts:

```sh
npx wrangler secret put IP_HASH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put GEOAPIFY_API_KEY
```

Generate `IP_HASH_SECRET` as at least 32 random bytes in a password manager. It hashes Cloudflare's trusted connection IP without storing the raw address. No cross-service gateway secret is needed.

Create a Turnstile widget restricted to the demo hostname. The Worker verifies its hostname and `start`/`lookup` action. There is no production bypass flag. Create a server Geoapify key and a separate public map-tile key restricted to the deployment origin with a usage budget. Referrer headers send the origin to the map provider; required attribution remains visible.

For the Cloudflare frontend build set:

```dotenv
NEXT_PUBLIC_BACKEND_ENABLED=true
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_public_widget_key
NEXT_PUBLIC_GEOAPIFY_MAP_KEY=your_restricted_public_tile_key
```

These are public build values, not secrets. Keep the backend flag false for the GitHub Pages preview. Worker secrets are runtime bindings and are never bundled into the frontend. Local `.dev.vars` is ignored by Git; `.dev.vars.example` contains blanks only.

## 6. Build, verify and deploy

```sh
npm run typecheck
npm test
npm run build
npm run worker:check
npx wrangler deploy
```

Do not deploy an export built with the wrong hostname keys or base path. The Cloudflare build uses `/`; the Pages build is separately staged under `/Ct-311`.

Before opening the pilot: test real public submission with a photo, retry without duplication, receipt lookup, staff login/MFA, assignment, reopening, revoked membership, direct photo requests without cookies, mismatched origins, alternate hostnames and the maximum file size. Test with two staff accounts editing the same report. Confirm the custom domain's Access policy covers backend routes as well as the page. Confirm R2 public access remains off and Turnstile rejects another hostname.

## 7. Migration boundary

No existing live Convex database was configured, so this is a code/schema migration, not a production data transfer. The previous implementation remains in Git history. If real records exist elsewhere, a separate verified data migration is required; these scripts do not copy or erase them.
