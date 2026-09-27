# Consolidated service costs

Updated September 27, 2026. The application now uses **Cloudflare plus Geoapify**. The previous Convex, Clerk and Vercel subscriptions are no longer required. Cloudflare has multiple metered products under one account; fewer vendors does not mean zero usage charges.

| Cloudflare product | Why it is used | Pricing basis |
| --- | --- | --- |
| Workers + static assets | Public/admin hosting and same-origin backend | Paid plan starts at $5/month; request/CPU overages apply |
| D1 | Reports, separate contacts, staff membership, audit and search | Included paid-plan allowances; then rows read/written and storage |
| R2 Standard | Private re-encoded photos | 10 GB-month included; then $0.015/GB-month, plus operations over allowances |
| Access | Staff identity gate and MFA policy | Budget the eligible free tier for the 25-person demo; confirm current account/user limits and municipal requirements before contracting |
| Turnstile | Bot verification | Free tier |
| Durable Objects | Strongly consistent, distributed rate limits | Metered requests/duration/storage, with paid-plan allowances; budget usage rather than assuming free |
| Images transformations | Decode/resize images, strip metadata, store safe WebP output | First 5,000 unique transformations included; paid transformations beyond that $0.50/1,000 |

Sources: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Access](https://www.cloudflare.com/plans/zero-trust-services/), [Turnstile](https://developers.cloudflare.com/turnstile/plans/), [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Images](https://developers.cloudflare.com/images/pricing/).

Images is used once on upload; photos are stored in R2, not in the hosted Images storage product. It is necessary because native Sharp does not run as this Worker's image processor. The free transformation tier can refuse new transformations once its allowance is exhausted; enable an appropriate paid usage plan before a real pilot.

Geoapify still supplies address autocomplete, reverse geocoding and map tiles. The [API 10 plan](https://www.geoapify.com/pricing/) starts at $59/month for 10,000 credits/day and up to 12 requests/second. Free usage may suffice for early demonstrations, but high concurrency can require a higher rate/credit tier. It is the only separate application API vendor. An existing organizational identity provider can be connected to Access; its licensing, if any, is outside this estimate.

**Starting subscription floor: $5 + $59 = $64/month**, or **$96 with a 50% markup**, assuming eligible free/included allowances elsewhere. This is not an all-inclusive bill: add actual Cloudflare usage, storage growth, transformation overages, map upgrades, taxes, domain renewal, backup copies and any paid Access/WAF requirements. No hosted traffic test has established a steady-state monthly bill.

For quoting, use **actual attributable vendor cost × 1.50**. A provisional **$150/month infrastructure allowance** covers $100/month of vendor cost with that markup; charge costs above $100 at 1.50× under an agreed usage/upgrade policy. Reconcile against the first month's measurements. For larger or official deployment, price from measured volume and required support/SLA rather than the subscription floor.

Maintenance labor remains separate. For example, three hours at an assumed internal $100/hour cost with 50% markup is $450; adding the $150 infrastructure allowance gives a provisional $600/month package. This is an illustrative cost model, not a claim about Reimage's actual costs or a city service-level commitment.

The 1,000-visitor/100-reports-per-minute targets are peaks. Continuous 100 reports/minute would mean 4.32 million reports in 30 days and needs a very different budget. Do not promise unlimited volume. No AI, translation, SMS, constituent-email or separate photo-hosting API is required.
