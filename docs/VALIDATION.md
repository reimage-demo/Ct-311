# Validation record

Local verification completed September 26, 2026. No cloud services were provisioned, no city system was contacted with report data, and no production records were used.

## Executed

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed |
| Production compilation (`npm run build`) | Passed; public information routes prerendered |
| Local automated tests (`npm test`) | 28 passed across 3 files |
| Production dependency audit (`npm audit --omit=dev`) | Zero reported vulnerabilities |
| Playwright test discovery | 12 cases discovered across desktop and mobile projects; execution pending |

The automated tests use Convex's local test harness, real Sharp image processing, and controlled HTTP verification responses. They cover idempotent finalization, private-field exclusion from status responses, invalid/expired credentials, transactional lookup throttling, anonymous and uninvited access, role escalation, immediate membership revocation, stale staff edits, valid status transitions, session-bound attachment slots, cross-session removal, cleanup preservation of finalized reports, upload origin restrictions, and Turnstile hostname/action checks. Image tests cover unsupported/truncated content, byte limits, re-encoding and metadata removal. An HTTP integration test uploads a real synthetic image, finalizes its report, serves it to authorized staff, and denies access after revocation.

Browser inspection used the local running Next.js app. Confirmed:

- Public home, directory, reporting, lookup and staff setup routes render.
- The 43-service directory filters to the pothole entry using Spanish search.
- Empty issue submission shows validation feedback and focuses the error summary.
- Switching English to Spanish retains the entered address and description.
- A synthetic report advances through all five steps using a manual intersection and no photo; review preserves the entered contact information and original-language description.
- Missing service credentials produce explicit setup states and disabled submission/lookup, with no simulated success.
- Report review, status and staff setup pages fit a 390-pixel viewport without horizontal page overflow. Desktop home was visually inspected as well.
- The inspected informational/staff setup tab produced no browser error logs.

## Prepared but not executed

The Playwright suite in `tests/e2e/public.spec.ts` includes public navigation, bilingual draft continuity, validation, directory search, axe checks and responsive overflow checks. Install its Chromium and WebKit browsers and run `npm run test:e2e`. Discovery alone is not an accessibility or browser-suite pass.

Dedicated Convex, Clerk, Geoapify and Turnstile projects are intentionally absent. The following require the setup in `SETUP.md` and remain unverified:

- Deployment of Convex functions and native Sharp dependencies; real persistent submission, receipt recovery and public lookup through the deployed HTTP gateway.
- Actual Clerk invitations, mandatory MFA, token integration, authenticated staff screens and multi-user live updates.
- Geoapify address results, real pin movement/reverse geocoding, geolocation denial and provider outage behavior.
- Browser upload progress, retry/removal during interrupted connections, expired-session recovery, and protected image delivery through the complete hosted stack.
- Full keyboard-only and assistive-technology review, 200% zoom, physical phone/tablet testing, and a qualified Spanish-language review. WCAG 2.2 AA is a target, not a certification.
- Independent penetration testing, malicious image corpus/fuzz testing, cross-origin and edge rate-limit exercises, and an actual backup/restore drill.

## Capacity results

**No load test has been run.** The 100,000-record seed and 30-minute harness are included in `scripts/seed.mjs` and `load/city-surge.mjs`. Follow `OPERATIONS.md` in an isolated synthetic deployment. The targets remain 1,000 concurrent visitors, 100 submissions/minute, 25 active staff, p95 lookup/queue under one second, p95 finalization under two seconds, and fewer than 1% unexpected failures without lost or duplicate reports.

The operator harness measures selected backend and page requests. It does not replace a full browser test of authentication, challenges, uploads, map quotas and live subscriptions. Do not advertise capacity or security certification from local tests alone.
