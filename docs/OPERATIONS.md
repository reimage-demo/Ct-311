# Security and capacity operations

## Trust boundaries

- The public website never reads report documents directly. Its Next.js gateway supplies a server-only shared secret and a keyed hash of the platform-verified network address to Convex HTTP actions. Convex itself verifies the gateway secret, bot check, session, quotas, and validators.
- Start sessions and status lookups require single-use Turnstile verification with hostname/action checks. Session credentials are 256 random bits, kept in browser memory; only their hash is stored. Session duration is 24 hours. Expired sessions cannot be used to finalize or upload.
- Report numbers contain 128 random bits. Public lookup returns only status and timestamps, not arbitrary staff text. Report numbers are POST bodies, not URLs. Do not add request-body logging or analytics.
- Clerk validates identity. Every staff function separately checks active Convex membership. Configure required MFA in Clerk, as described in SETUP.md. The application cannot remotely configure or certify those account settings.
- Photos use authenticated byte delivery through `/api/photo/[id]` and Convex `/photo`, with `private, no-store`. No `storage.getUrl()` calls or persistent bearer download URLs are used. File IDs alone do not grant access.
- Public uploads reserve slots belonging to the submission. The receiver bounds streamed bytes to 10 MB. Sharp accepts only JPEG/PNG/WebP magic signatures, checks decoded size (40 million pixels), rejects animation, rotates, resizes to at most 2400×2400, and encodes a fresh WebP without metadata. Photos never execute as SVG/HTML. They are quarantined before staff visibility.
- Every report is finalized once in a single transaction, including contact and file relationships. Client retry returns the original receipt. Staff status updates compare the stored version and append an audit event atomically. Audit records cannot be changed through the application; deployment administrators still control the database.

## Rate and resource limits

Defaults: 10 session starts/hour per IP hash; 20 status lookups/minute per IP hash; 30 geocoding requests/minute and 120/hour per session; 12 upload attempts/minute, 24 total attempts, six active files/session. Aggregate start/lookup budgets use 16 shards (30 starts/minute/shard, 100 lookups/minute/shard) to avoid a single hot counter. Multi-user networks can reach IP limits; assess pilot data before adjusting.

Backend limits supplement, rather than replace, deployment WAF limits and Geoapify/Convex budgets. Turnstile verification occurs before creating a session. Monitor failed challenges and gateway traffic at the hosting edge. Never disable security in order to pass a load test.

The 15-minute cleanup job processes at most 50 expired sessions and 100 expired rate buckets per batch, then schedules another bounded batch after one second whenever a batch is full. Monitor oldest-expired-session age to confirm that cleanup keeps up. Completed reports are never automatically removed. Orphaned storage from a process crash requires the reconciliation process below.

## Backup, restore, and retention

Use a dedicated demo deployment and enable scheduled backups available on the selected Convex plan. Restrict dashboard access with MFA. Keep exports encrypted and access-controlled; photos and contacts are part of the backup scope. Do not commit exports.

Before official operation, obtain a city-approved retention schedule, records-request process, data residency requirements, incident owner, RPO, and RTO. No claim of municipal compliance is made by this demo.

Restore drill: restore a backup into a separate non-public deployment using the Convex dashboard's current restore workflow, configure isolated authentication, verify sample report/contact/file relationships and audit histories, verify unauthorized access still fails, then record duration and outcome. Never restore over the active demo without a separate recovery decision.

Reconciliation: inventory storage IDs and attachment references in bounded pages using a deployment-admin maintenance script. Treat files referenced as `rawId` or `storageId` as in use. Only remove unreferenced objects older than 24 hours after reviewing the candidate list. This is an operational recovery procedure, not a public API. Normal upload errors delete both raw and normalized files; a hard process crash between storage and database writes can still leave an orphan.

## Monitoring and alerts

Use Convex deployment metrics and the host's operational dashboard. Do not send names, descriptions, contact fields, files, tokens, or request bodies to logging services. Monitor p95 query/finalize latency, failure rate, rejected uploads, rate-limit volume, oldest expired session awaiting cleanup, storage growth, geocoding quotas, and function concurrency. Alert the demo operator at error rates over 1%, sustained latency above the targets, or provider usage over 80% of configured budget. These alerts require setup in the service dashboards; no external monitoring account was provisioned.

## Reproducible capacity exercise

The provided Node harness measures CDN responses, paginated staff queries, lookup, and atomic finalization. It does **not** certify whole-system throughput: Clerk, Turnstile, uploads, WebSockets, map quotas, browser rendering, and network conditions need separate staged measurements.

1. Create an isolated non-production deployment, configure it normally, seed 100,000 synthetic reports, and provision an active test staff member.
2. Set these variables in a trusted local shell or secret manager, not in frontend environment variables: `LOAD_BASE_URL`, `LOAD_CONVEX_URL`, `LOAD_ADMIN_KEY` (isolated deployment key only), `LOAD_STAFF_SUBJECT`, and `LOAD_CONFIRM=isolated-synthetic-demo`.
3. Run `node load/city-surge.mjs`. Defaults: 30 minutes, 1,000 public virtual visitors (one page visit every five seconds), 25 staff polling every three seconds, and 100 new submissions/minute, each followed by an idempotent retry and status lookup. The script uses the installed Convex client's internal admin impersonation facility solely in this operator-run harness. Never expose it as an application endpoint.
4. Results go to ignored `load/results/latest.json`. Targets: queue/lookup p95 below 1,000 ms; finalization p95 below 2,000 ms; unexpected failures below 1%; no receipt mismatch; at least 99% of the requested submission count acknowledged.
5. Separately exercise actual browser sessions with Clerk, real challenge completion, live photo uploads, and map use in staging. Check upload latency/processing, provider quotas, real-time staff update fan-out, disabled membership, and origin restrictions. Compare service plans to observed peak concurrency and choose adequate headroom before public use.

Optional smoke-test overrides: `LOAD_SECONDS=60`, `LOAD_VISITORS=10`, `LOAD_STAFF=2`, `LOAD_REPORTS_PER_MINUTE=10`. Even these create records and incur service traffic. No load run has been performed without the necessary dedicated services.
