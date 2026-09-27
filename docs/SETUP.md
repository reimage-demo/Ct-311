# Connect an isolated demonstration

The local build is complete without external accounts. The following configuration enables actual persistence, image processing, mapping, and staff access. Do not reuse Car Craft or Empire customer databases or credentials.

## 1. Convex

1. Create a dedicated development project using `npx convex dev`. Select the new Hartford demo project, not an existing client project. The CLI writes the deployment selection into `.env.local` and generates bindings.
2. Set `NEXT_PUBLIC_CONVEX_URL` to the project's `https://….convex.cloud` URL and `NEXT_PUBLIC_CONVEX_SITE_URL` to its corresponding `https://….convex.site` HTTP-actions URL.
3. Keep development and future hosted-demo deployments separate. `convex.json` externalizes Sharp so its native image-processing dependency runs in Convex Node actions.
4. Copy `.env.example` to `.env.local` before filling credentials if the CLI has not already created it. Never overwrite a CLI-generated deployment selection.

Generate two separate random 32-byte values locally for `GATEWAY_SECRET` and `IP_HASH_SECRET` using a password manager. Put both in `.env.local`; put **only GATEWAY_SECRET** in Convex. Do not share them through chat or check them in.

## 2. Clerk staff authentication

1. Create a dedicated Clerk application; enable invitation-only/restricted signup. Disable public sign-up. Invite the first administrator through Clerk.
2. Enable **Require multi-factor authentication**. Finish MFA enrollment before opening the portal. Do not enable an alternate sign-in flow that skips required session tasks.
3. Enable Clerk's Convex integration/JWT template with audience `convex`. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex to the Clerk Frontend API origin.
4. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `NEXT_PUBLIC_CLERK_FRONTEND_API_ORIGIN` in Next.js. The last value is an origin only, such as `https://example.clerk.accounts.dev`; it is included in the content security policy. Add the production custom Clerk origin before hosting.
5. Copy the invited administrator's Clerk `user_…` subject into Convex's `BOOTSTRAP_ADMIN_SUBJECT`. Run `npx convex run staff:bootstrap '{}'` once. Remove the bootstrap environment variable immediately afterward. This operation is internal and refuses to run after any staff member exists.
6. Open `/admin`. The account must both authenticate with Clerk **and** have active membership in Convex. Merely knowing the sign-in link or having a Clerk account grants no data access.

Membership administration grants application access; invitations themselves are issued in the Clerk dashboard. This keeps email delivery outside this website-only demo.

## 3. Turnstile and application origin

Create a Cloudflare Turnstile widget restricted to your demo hostname. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Next.js and `TURNSTILE_SECRET_KEY` in Convex.

Set **the same** `APP_ORIGIN` in Next.js and Convex, without a trailing slash. For this local preview use `http://127.0.0.1:3000` and allow that development hostname in the widget configuration. Alternatively use `http://localhost:3000` consistently in the browser and both environments. CORS intentionally rejects mixed origins.

The server verifies the Turnstile response's success, hostname, and action (`start` or `lookup`). There is no environment flag that disables verification. Only use a vendor test widget with synthetic records; validate its returned hostname/action against this strict check before relying on it for staging automation.

## 4. Geoapify

Create separate API keys:

- `GEOAPIFY_API_KEY` in Convex for server-side autocomplete and reverse geocoding.
- `NEXT_PUBLIC_GEOAPIFY_MAP_KEY` in Next.js for public map tiles, with allowed-origin/referrer restrictions and a usage cap in Geoapify.

Keep attribution visible. Configure provider quotas and budget alerts; the app also limits geocoding per submission session. Address results are restricted to a Hartford-area bounding rectangle. This is **not a city-boundary or road-ownership determination**; staff must verify every location before work is assigned. Manual entries intentionally remain possible during map outages.

## 5. Verify configuration

Convex environment variables: `APP_ORIGIN`, `GATEWAY_SECRET`, `CLERK_JWT_ISSUER_DOMAIN`, `TURNSTILE_SECRET_KEY`, `GEOAPIFY_API_KEY`. Use the dashboard or `npx convex env set NAME VALUE` in a trusted terminal; prefer the dashboard to avoid secret-bearing shell history.

Restart `npm run dev` after editing local environment variables. Next.js inlines public settings at build time; rebuild when public settings change.

Submit one synthetic report with a photo; save its receipt; sign in and update the report; check the public status. Test a second staff account, revoke it, and verify that subsequent report and photo requests fail. Test a signed-in account without membership. Confirm MFA cannot be skipped.

## 6. Synthetic examples

Set `DEMO_SEED_ENABLED=true` in the isolated Convex development project. With the correct deployment selected:

```sh
CONFIRM_DEMO_SEED=yes node scripts/seed.mjs 12
```

The seed is internal, creates clearly labeled synthetic records, and is disabled by default. Disable it after use. For the capacity exercise use 100000 in place of 12. It inserts in batches of 100, so expect 1,000 batches and billable resource use. It does not erase existing records. Re-running creates additional reports; use a fresh isolated deployment when an exact starting count matters.

## 7. Optional later Vercel hosting

No deployment was requested after the decision to finish locally. When ready, create a dedicated Vercel project, use the checked-in `vercel.json`, set the Next.js environment variables, configure the matching hosted Convex deployment, and rebuild. Use a stable preview hostname; dynamic preview hosts will not pass the origin/Turnstile restrictions without configuration.

Enable Vercel's WAF/rate limiting for `/api/public/*` and staff sign-in before public sharing. Raw photo uploads go to Convex HTTP actions and do not pass through Vercel's body-size limit. Keep gateway secrets out of preview logs and browser bundles. Use Vercel-generated `x-vercel-forwarded-for`, not a client-supplied forwarded-IP header. A different hosting platform requires an equivalent trusted-proxy IP configuration; the local fallback deliberately uses one shared development bucket.
