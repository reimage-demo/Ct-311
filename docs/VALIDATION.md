# Validation record

Local Cloudflare rewrite verification completed September 26–27, 2026. No Cloudflare account or live resources were provisioned. All records used for testing were synthetic.

## Executed

- TypeScript compilation and Next.js static production build.
- 31 automated tests using real local D1, R2, Durable Objects and Images bindings through Miniflare. Access JWTs use real signatures with controlled certificate responses; Turnstile responses are controlled fixtures. Tests invoke the HTTP handler with these bindings rather than a deployed Worker.
- Worker deployment dry run; no remote deployment.
- Dependency audit: zero reported vulnerabilities at verification time.

Tests cover signed/forged/expired/wrong-audience Access tokens, service-token rejection, inactive and uninvited staff, role escalation, access revocation, conflicting edits, status transitions and reopening, append-only audit history, transaction rollback, concurrent duplicate submissions, strict input validation, origin restrictions, challenge hostname/action validation, transactional throttling, private-field exclusion from public lookup, protected photo delivery, cross-session attachment restrictions, concurrent slot limits, malformed and oversized images, metadata removal, and expired-draft cleanup. Finalized records survive cleanup; expired finalized credentials cannot be renewed to recover their receipt.

## Local data-layer benchmark

The benchmark seeded **100,000 synthetic reports**, ran reads in batches of 25 concurrent operations and finalized 100 additional reports with paired duplicate retries. Recorded output: [local-benchmark.json](results/local-benchmark.json).

| Operation | p95 |
| --- | ---: |
| Queue | 248 ms |
| Status-filtered queue | 247 ms |
| Service-filtered queue | 235 ms |
| Full-text search | 226 ms |
| Status data lookup | 218 ms |
| Paired finalization and retry | 1,626 ms |

Zero operation failures, receipt mismatches, lost records or duplicate reports were observed. The final report count was 100,100. Query plans were inspected for index use. Search pagination uses FTS row order to avoid sorting every matching report.

**These are local data-layer measurements, not hosted capacity guarantees.** They exclude edge routing, Access authentication, Turnstile, upload processing, maps and WAN latency. Run `npm run benchmark:local` with Node 22 or newer to reproduce.

## Not yet executed

- A deployed Cloudflare end-to-end test with real Access policies, required MFA, Turnstile, private R2, scheduled cleanup and Images billing/limits.
- The 30-minute hosted acceptance test at 1,000 concurrent visitors, 100 submissions/minute and 25 staff. The isolated-environment harness and fixture generators are provided; see `OPERATIONS.md`. It must meet p95 lookup/queue under one second, finalization under two seconds excluding uploads, fewer than 1% unexpected failures, and no lost or duplicate reports before that capacity is advertised.
- Browser automation in `tests/e2e/public.spec.ts`, actual authenticated staff workflows, upload interruption/retry and real map provider behavior. The hosted load harness also excludes challenge solving, login/MFA, public lookup verification, photos, maps and browser rendering.
- Full keyboard and assistive-technology review, 200% zoom, physical device testing and qualified Spanish-language review. WCAG 2.2 AA remains a target.
- Independent security review, image fuzzing, provider outage drills, actual backup/restore and retention approval.

The GitHub Pages deployment is a public interface preview. With service configuration absent, submission and staff access show explicit setup states. It does not accept real complaints or connect to Hartford's existing system.
