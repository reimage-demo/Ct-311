# Hartford 311 — city-proposal demonstration

A bilingual public website and private staff workspace built with Next.js 16, TypeScript, Convex, Clerk, Leaflet/Geoapify, and Cloudflare Turnstile. This is **not an official Hartford service**. It does not submit records to Accela or send email/SMS.

**Public preview:** https://reimage-demo.github.io/Ct-311/ · **Staff setup:** https://reimage-demo.github.io/Ct-311/admin/

GitHub Pages serves a credential-free static preview from the `gh-pages` branch. The public pages, bilingual service directory and five-step form work for review; submission, lookup and staff authentication remain unavailable. Server endpoints and private report-detail routes are excluded from that artifact. The full backend remains in `main` for later deployment.

To rebuild the preview, run `npm run build:pages` and publish the contents of `.pages-build/out` (including `.nojekyll`) to `gh-pages`. `PAGES_BASE_PATH` defaults to `/Ct-311`. This isolated build does not modify the full server application or include environment files. GitHub Pages does not apply the server application's security headers.

## Start locally

Requires Node 20.19+ (Node 22 LTS recommended).

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. No keys are required to review the complete public website, bilingual form, service catalog, status-page layout, and staff setup screen. Saving reports, uploading photos, maps, and staff sign-in deliberately remain unavailable until their services are configured. There is no fake persistence or authentication bypass.

Routes: `/`, `/services`, `/report`, `/status`, `/contact`, `/privacy`, `/accessibility`, `/admin`, `/admin/report/[id]`, `/admin/team`.

## Connect the real demo backend

Follow [SETUP.md](docs/SETUP.md) in order. Use new dedicated demo accounts/projects and synthetic records. Copy `.env.example` to `.env.local` and keep it out of version control. Frontend keys beginning `NEXT_PUBLIC_` are public by design; all other secrets stay on the server.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

The browser suite uses Playwright and axe and requires installed Playwright browsers (`npx playwright install chromium webkit`). The mobile project uses WebKit. Backend tests use `convex-test` and Sharp; they do not provision or alter a cloud database. See [VALIDATION.md](docs/VALIDATION.md) for what was actually executed and remaining checks.

Convex's installed code generator produced the local schema/server bindings. `npm run codegen:offline` regenerates typed function references without a deployment using the installed Convex generator. Run `npx convex dev` after setup to regenerate official deployment bindings and validate the deployed backend.

## Handoff

- [API accounts, monthly costs and proposed pricing](docs/COSTS.md)
- [Setup and service configuration](docs/SETUP.md)
- [Staff walkthrough](docs/STAFF.md)
- [Security, retention, backup, and capacity operations](docs/OPERATIONS.md)
- [Service research and reference inventory](docs/SOURCES.md)
- [Validation and remaining external checks](docs/VALIDATION.md)

Public copy and the full 43-service bilingual catalog live in `lib/services.ts`. Shared validators, status labels, transition rules, and public projection live in `lib/domain.ts`. Convex enforces authorization independently of the Next.js UI.

Only the static preview is deployed; nothing is connected to a city system. Removing the demonstration notices is not sufficient to launch an official service; city integration, identity, retention, operational ownership, and incident response must first be agreed.
