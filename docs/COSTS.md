# Service accounts and monthly pricing

Budget prepared September 26, 2026 in USD, before taxes. Published list prices are estimates, not a capacity guarantee or a vendor quote. No paid services have been purchased.

## Required services

| Service | Purpose in this app | Starting paid plan/month | With 50% markup |
| --- | --- | ---: | ---: |
| Convex Professional | Report/contact database, private photo storage, server functions, live staff updates and daily backups | $25 for one developer | $37.50 |
| Clerk Pro | Invited staff sign-in, sessions and MFA | $25, billed monthly | $37.50 |
| Geoapify API 10 | Address autocomplete, reverse geocoding and map tiles for the movable pin | $59 | $88.50 |
| Cloudflare Turnstile Free | Server-verified bot challenges on intake and lookup | $0 | $0 |
| Vercel Pro | Hosts both public pages and /admin, CDN, HTTPS and the Next.js server endpoints | $20 starting plan | $30 |
| **Total** | **Excludes usage overages and labor** | **$129** | **$193.50** |

Sources: [Convex](https://www.convex.dev/pricing), [Clerk](https://clerk.com/pricing), [Clerk monthly-billing explanation](https://clerk.com/articles/clerk-pricing-explained), [Geoapify](https://www.geoapify.com/pricing/), [Turnstile](https://developers.cloudflare.com/turnstile/plans/), [Vercel](https://vercel.com/pricing).

Convex developer seats mean people managing the backend deployment, not the 25 municipal staff using this application. Clerk users here are staff only; residents do not create accounts. Application roles and memberships are stored in Convex, so the Clerk enhanced B2B Organizations add-on is unnecessary. Use authenticator-app MFA to avoid SMS authentication charges. Additional provider-dashboard seats, deployments or projects can change the bill; do not assume allowances are exclusive to this app if sharing an agency account.

Geoapify API 10 includes 10,000 credits/day and up to 12 requests/second. Its free plan can support early testing, but is not the basis of this operating budget. One map tile costs 0.25 credits, and an autocomplete/reverse-geocoding call costs one credit. Illustratively, 50 tiles + six address calls + one reverse lookup = 19.5 credits per map session. At 500 such sessions/day that is 9,750 credits before staff map use, retries and abandoned forms. Bursts may require a higher request-per-second allowance even when the daily quota is sufficient. See [Geoapify credit definitions](https://www.geoapify.com/pricing-details/).

## What to charge

The strict API/hosting formula is **actual attributable vendor cost × 1.50**. At the starting plan total, that is **$193.50/month**. A 50% markup is a 33.3% gross margin, not a 50% gross margin.

For an initial pilot, propose **$300/month infrastructure allowance**, covering up to $200/month of vendor costs with the requested markup. The $71 above the $129 base is a contingency allowance, not a measured usage prediction. Charge additional attributable vendor spend above $200 at 1.50×, with agreed alerts and an approval threshold for plan upgrades. Reconcile actual usage monthly; do not promise unlimited traffic at a fixed price.

If ongoing maintenance is included, price labor explicitly. Example proposal: **$750/month total**, comprising the $300 infrastructure allowance and $450 for up to three maintenance hours. The labor calculation assumes an internal cost of $100/hour: 3 × $100 × 1.50 = $450. Replace that assumption with Reimage's actual cost and required service level. Those hours can cover dependency updates, error/usage review, backup checks and minor fixes. New features, city integrations and 24/7 response require separate scope.

The original targets (1,000 concurrent visitors, 100 reports/minute, 25 staff) describe peaks, not monthly volume. At 100 reports/minute continuously for 30 days, volume would be 4.32 million reports. That is a different budget. Load testing, monthly report/page counts, photo sizes, retention and provider limits must determine the production quote. Photos remain stored, so storage costs accumulate over time. Convex and Vercel compute/network overages and Geoapify tier upgrades are variable costs. Any municipal SLA, procurement or enterprise-security requirements may require materially higher/custom plans.

Domain registration/renewal, taxes, optional external monitoring, paid WAF features and external backup copies are excluded from these amounts. GitHub stores the source; it does not run this Next.js/Convex application. No Google Maps, Mapbox, Twilio, SendGrid, paid translation or AI API is needed. Leaflet and Sharp are libraries; browser geolocation has no separate API subscription. Photos use Convex rather than a separate image-hosting account.

## Credentials to configure

- Convex: deployment URL and HTTP-actions URL; a deployment credential for later hosting automation.
- Clerk: publishable key, secret key and JWT issuer; configure the Convex JWT template, restricted signup and required MFA.
- Geoapify: server key for geocoding, separate restricted public tile key.
- Turnstile: public widget site key and private verification secret.
- Vercel: a hosting project connected to the GitHub repository, with the server and public environment settings.
- Application-generated secrets: `GATEWAY_SECRET` and `IP_HASH_SECRET`; these are not additional paid APIs.

See [.env.example](../.env.example) and [SETUP.md](SETUP.md). Keep secrets out of GitHub and configure distinct development and hosted environments.
