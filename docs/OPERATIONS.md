# Security and capacity operations

## Boundaries and authorization

The browser calls only same-origin Worker endpoints. There are no public D1 or R2 credentials and no legacy Convex endpoints. Every staff query, mutation and photo request verifies the Access JWT signature, issuer, audience and expiry, then reads active membership from primary D1. Membership is not cached. Writes also require active membership inside the SQL statement, preventing a revocation between initial authorization and the write. Assignment and membership changes additionally require the administrator role. Staff membership edits and report edits compare versions.

Access must require MFA and cover the page, staff API and photo paths; configure and test this in SETUP.md. The application does not independently prove that an operator configured MFA correctly. Alternate workers.dev/preview routes are disabled. Configure narrowly scoped Cloudflare deployment roles and protect the Cloudflare account with MFA.

All user data is parameterized in SQL. Backend Zod validators reject unknown fields and bound lengths, enum values, coordinates, page sizes and cursor formats. React renders descriptions/notes as text. Writes require an exact Origin match; cross-site requests are rejected and no permissive CORS is returned. Public status is an explicit allowlist of statuses and timestamps only. Tracking credentials are POST bodies, never URLs. Request-body logging is prohibited. Worker observability is disabled in the template to avoid accidentally recording sensitive request context; enable only reviewed/redacted structured telemetry.

## Atomicity and private files

D1 `batch` atomically creates the report and separate contact record. SQL triggers validate the session and photo readiness, bind photos, set the session receipt, and append audit history. A unique session hash prevents duplicate reports; concurrent retries return the committed receipt. A failed contact insert rolls the whole transaction back. Database triggers prevent application edits/deletes of audit history. Cloudflare account administrators still control the schema; this is not immutable external archival storage.

Report numbers contain 128 random bits. Submission tokens contain 256 random bits; only their hashes are stored. Sessions expire after 24 hours. Before a session expires, a lost submission response can be retried for the same receipt. An expired session cannot be used to retrieve a receipt; the resident must retain the number.

Uploads are limited to six active slots, 24 lifetime attempts/session, 10 MB/file and 40 million decoded pixels. JPEG/PNG/WebP signatures are checked before invoking Cloudflare Images; the image decoder verifies content and dimensions. Output is a resized, fresh WebP, stripping metadata and flattening animation to a still image. Original bytes are never publicly accessible and never stored in R2. Each reservation has a unique object key and a two-minute lease, so an old request cannot overwrite a retry's image. Finalization cannot attach a reserved/deleting file. Uploaded bytes are only served after finalization and a fresh staff membership check, with `private, no-store` and no bearer storage URL.

Cron cleanup runs every five minutes in bounded batches. It removes expired reserved uploads and abandoned sessions. Removal first tombstones an attachment; if R2 deletion fails, the next cleanup retries it. A cursor-based R2 sweep removes unreferenced objects older than 24 hours, covering a crash between object storage and DB writes. Finalized reports and their photos are never automatically deleted. Monitor cleanup backlog; one invocation handles at most 100 attachment candidates and 100 storage objects. Increase cadence/batch scheduling after measurement if cleanup falls behind.

## Abuse controls and cost limits

A Durable Object handles each keyed identity/operation's token bucket transactionally. Limits remain consistent across edge locations and do not write a shared D1 rate counter. Objects expire their bucket storage via alarms. Raw IP addresses are HMAC-hashed with a server secret. Only Cloudflare's ingress-generated `CF-Connecting-IP` is used; local testing without it shares a bucket.

Default budgets:

- API ingress: 1,200 requests/minute/IP hash, before expensive parsing/verification.
- Session starts: 10/hour/IP; aggregate 16 shards × 30/minute.
- Public lookup: 20/minute/IP plus Turnstile on each lookup.
- Maps: 30/minute and 120/hour/session.
- Uploads: 12/minute/session, six simultaneous slots, 24 attempts lifetime.
- Submission: 10/minute/session; idempotent retry still consumes a token.
- Staff calls: 180/minute/member; photos: 120/minute/member.

Shared networks can reach IP limits. Measure pilot behavior before adjusting limits. Configure Cloudflare WAF rules for `/api/*`, provider budgets and Geoapify spending/rate caps; application throttling cannot make abusive traffic free. Rate-limit errors use HTTP 429 with Retry-After. SQL/internal exceptions return a generic 503 without exposing records or SQL. No option disables JWT verification, membership, Turnstile or throttling in production to make a load test pass.

## Capacity design and limits

Public pages are prerendered assets served from Cloudflare's asset CDN without D1 calls. Staff views fetch indexed pages of at most 50 records; active views poll every 15 seconds and pause while hidden. There are no whole-database subscriptions or global request counters. Search uses FTS with a row-id cursor; search results are ordered by insertion, while ordinary queues use received-date/id cursors. Audit history is paginated, and photos load lazily. Indexed lookups, same-transaction writes and bounded request bodies limit resource use.

One D1 database still serializes writes and has finite storage/query limits. Indexes and FTS consume storage. The current [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) include a 10 GB paid per-database ceiling; photo bytes live in R2 rather than D1. Monitor database/index size, rows scanned, query durations and queue contention. Plan partitioning/archival before a measured storage/throughput limit; do not assume unlimited horizontal write scale from the word “serverless.”

The targets remain 1,000 concurrent visitors, 100 submissions/minute and 25 staff, with p95 lookup/queue <1 second, p95 finalization <2 seconds, <1% unexpected failures and no lost/duplicate reports. Local benchmarks do not establish cloud performance, geographic latency, provider limits or contractual availability.

## Load exercises

1. Run `npm run benchmark:local` for an ephemeral 100,000-report local D1 test with 25 concurrent operations and duplicate-finalization checks. Output: `load/results/local-benchmark.json`. This bypasses HTTP/auth/Turnstile for data-layer isolation and must not be presented as end-to-end capacity certification.
2. For a hosted isolated demo, generate 100,000 rows with `CONFIRM_DEMO_SEED=yes node scripts/seed.mjs 100000`. Review and import `load/results/seed.sql` using Wrangler D1 execute. Never import into a real-data database.
3. Prepare 3,000 one-hour synthetic sessions with `CONFIRM_DEMO_SEED=yes node scripts/load-fixtures.mjs 3000`, then apply `load/results/sessions.sql` only to the isolated load database. This is operator provisioning; no authentication-bypass endpoint is added to the Worker.
4. Obtain current authenticated Access cookies for 25 distinct active test staff accounts after MFA. Store only the cookie values as a local JSON array with restrictive permissions; never commit or print them.
5. Set `LOAD_BASE_URL`, `LOAD_SESSION_FILE`, `LOAD_STAFF_COOKIE_FILE`, `LOAD_CONFIRM=isolated-synthetic-demo`, then run `node load/city-surge.mjs`. Defaults are the agreed 30-minute traffic levels. Use `LOAD_SECONDS=60 LOAD_VISITORS=10 LOAD_STAFF=2 LOAD_REPORTS_PER_MINUTE=10` for an initial smoke run. This creates synthetic records and provider costs.
6. Review `load/results/hosted.json`, actual D1 report counts and provider metrics. Reconcile expected submissions against stored reports; confirm duplicate retries return the same numbers. The harness treats any request failure as a failed run and records throttles separately.
7. The hosted harness covers CDN requests, authenticated queue calls and finalization using operator-prepared sessions. It explicitly excludes challenge/session-start, public lookup verification, login/MFA throughput, images/maps and browser rendering. Measure those separately using real browser sessions and valid Turnstile tokens. Public lookup latency must be measured end-to-end before claiming its target is met.

## Backups, monitoring and recovery

D1 Time Travel is a database recovery mechanism, not a backup of R2. Configure an encrypted, access-controlled export/copy process for BOTH the D1 database and private photo bucket. Before official operation, define retention, record-request handling, residency, incident ownership, RPO and RTO with the city.

Restore into a separate non-public environment: restore/export-import D1, restore the corresponding R2 objects, verify contact/file relationships and immutable audit triggers, then confirm anonymous and revoked-user access fails. Never overwrite an active environment during a drill. No remote restore drill has been performed.

Monitor p95 API/query latency, error/429 rates, CPU time, Durable Object usage, D1 read/write/storage growth, R2 objects/operations, image transformations, Geoapify credits and oldest expired attachment. Alert at >1% unexpected errors or sustained latency above targets; set usage alerts before public sharing. Configure a WAF/API budget owner. Application logs must contain only route categories, status, durations and opaque incident IDs—no body, credential, tracking number or contact fields. Dashboard alerts and backup jobs require account setup; they were not silently provisioned.
