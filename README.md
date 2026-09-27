# Hartford 311 — city-proposal demonstration

A bilingual Next.js website with a Cloudflare backend: Workers, D1, private R2 photos, Access staff authentication, Turnstile, Durable Object throttling and Images processing. Geoapify is the only separate application API vendor. No city/Accela integration, constituent accounts, email or SMS updates.

**Public preview:** https://reimage-demo.github.io/Ct-311/ · **Staff setup:** https://reimage-demo.github.io/Ct-311/admin/

The GitHub Pages preview remains static and credential-free. It cannot save reports or authenticate staff. The Cloudflare rewrite is implemented locally; cloud resources, Access policies and hosted acceptance testing still require the dedicated account setup below. No live municipal data has been used.

## Local development

Use Node 22 or newer (Node 24 LTS recommended), then:

```sh
npm ci
npm run dev
```

The public site runs at http://127.0.0.1:3000 without keys. For the actual Worker locally:

```sh
npm run build
npm run db:migrate:local
npm run worker:dev
```

This serves the static Next.js export and same-origin API on localhost:8787. Copy `.dev.vars.example` to `.dev.vars` for Worker settings. Staff endpoints never have a development authentication bypass; tests generate and verify signed fixture JWTs. Copy `.env.example` to `.env.local` for public build settings and rebuild after changes.

## Architecture

- `worker/index.ts`: same-origin API, response security headers, staff/photo protection.
- `worker/migrations/0001_initial.sql`: D1 schema, indexes, FTS search, transactional guards and append-only audit triggers.
- `worker/security.ts`, `rate-gate.ts`: Access signature/issuer/audience validation, fresh membership checks, credential hashing and distributed transactional rate limits.
- `worker/photos.ts`: bounded input, actual image validation, metadata-free WebP conversion, private R2 delivery and bounded cleanup.
- `lib/staff-client.ts`: paginated, visibility-aware polling; revoked access clears the staff screen.
- `lib/services.ts`: researched bilingual 43-service catalog.

The app is statically rendered; Cloudflare Workers runs the server APIs. No Next.js runtime adapter, Convex, Clerk or Vercel account is required. Git history preserves the previous implementation.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run worker:check
npm run benchmark:local
npm audit
```

Tests use local Cloudflare D1, R2, Images and Durable Object bindings through Miniflare. External identity/challenge responses are controlled fixtures. `worker:check` packages the Worker without deployment. `benchmark:local` creates an ephemeral 100,000-report database, performs concurrent queries/submissions, records JSON under ignored `load/results`, and disposes the local database.

The prepared browser suite uses Playwright/axe (`npm run test:e2e`) and requires browser installation. See [validation](docs/VALIDATION.md) for actual executed results and outstanding tests.

## GitHub Pages preview

Run `npm run build:pages` and publish `.pages-build/out`, including `.nojekyll`, to `gh-pages`. The isolated build strips all public API keys and copies no environment files. GitHub Pages does not execute the Worker or apply the Cloudflare headers configuration. It is a visual/workflow preview only. Keep Pages configured to `gh-pages`, not `main`.

## Handoff

- [Cloudflare setup and deployment](docs/SETUP.md)
- [Security, capacity, backup and monitoring](docs/OPERATIONS.md)
- [Staff walkthrough](docs/STAFF.md)
- [Service-source inventory](docs/SOURCES.md)
- [Validation and test limitations](docs/VALIDATION.md)
- [Consolidated service costs](docs/COSTS.md)
