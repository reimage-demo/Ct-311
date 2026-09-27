/** Backend/CDN capacity harness. Never run against production or real records.
 * Uses deployment-admin impersonation ONLY inside this script to exercise real
 * staff authorization and internal intake; does NOT measure Clerk/Turnstile/map
 * provider performance, browser rendering, uploads, or WebSocket fan-out.
 */
import { ConvexHttpClient } from "convex/browser";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const {
  LOAD_BASE_URL,
  LOAD_CONVEX_URL,
  LOAD_ADMIN_KEY,
  LOAD_STAFF_SUBJECT,
  LOAD_CONFIRM,
} = process.env;
if (
  LOAD_CONFIRM !== "isolated-synthetic-demo" ||
  !LOAD_BASE_URL ||
  !LOAD_CONVEX_URL ||
  !LOAD_ADMIN_KEY ||
  !LOAD_STAFF_SUBJECT
)
  throw Error(
    "Set LOAD_* variables from docs/OPERATIONS.md. This generates synthetic reports and paid service traffic.",
  );
const seconds = Number(process.env.LOAD_SECONDS || 1800),
  visitors = Number(process.env.LOAD_VISITORS || 1000),
  staffCount = Number(process.env.LOAD_STAFF || 25),
  rpm = Number(process.env.LOAD_REPORTS_PER_MINUTE || 100);
const admin = new ConvexHttpClient(LOAD_CONVEX_URL, { logger: false });
admin.setAdminAuth(LOAD_ADMIN_KEY);
const staff = new ConvexHttpClient(LOAD_CONVEX_URL, { logger: false });
staff.setAdminAuth(LOAD_ADMIN_KEY, {
  subject: LOAD_STAFF_SUBJECT,
  issuer: "load-harness",
  tokenIdentifier: "load-harness|" + LOAD_STAFF_SUBJECT,
});
const samples = { page: [], queue: [], lookup: [], finalize: [] };
const failures = { page: 0, queue: 0, lookup: 0, finalize: 0 };
let mismatches = 0,
  submitted = 0;
const end = Date.now() + seconds * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function measure(kind, fn) {
  const start = performance.now();
  try {
    const value = await fn();
    samples[kind].push(performance.now() - start);
    return value;
  } catch {
    failures[kind]++;
    samples[kind].push(performance.now() - start);
    return null;
  }
}
async function visitor(i) {
  await sleep(i % 1000);
  while (Date.now() < end) {
    await measure("page", async () => {
      const r = await fetch(
        LOAD_BASE_URL + ["/", "/services", "/contact", "/status"][i % 4],
      );
      if (!r.ok) throw Error();
      await r.arrayBuffer();
    });
    await sleep(5000);
  }
}
async function operator(i) {
  await sleep(i * 40);
  while (Date.now() < end) {
    await measure("queue", () =>
      staff.query("staff:list", {
        paginationOpts: { numItems: 25, cursor: null },
      }),
    );
    await sleep(3000);
  }
}
async function reports() {
  const pending = new Set();
  let i = 0;
  while (Date.now() < end) {
    const seq = i++;
    const task = (async () => {
      const tokenHash = createHash("sha256")
        .update(randomBytes(32))
        .digest("hex");
      try {
        await admin.mutation("intake:start", {
          tokenHash,
          ip: "load-" + seq,
          shard: seq % 16,
        });
      } catch {
        failures.finalize++;
        return;
      }
      const draft = {
        serviceId: "pothole",
        description: "SYNTHETIC LOAD TEST. This is not a real issue.",
        address: "550 Main Street, Hartford, CT",
        landmark: "Load test",
        locationMethod: "manual",
        name: "Load Test Resident",
        email: "load@example.invalid",
        phone: "",
        preferredContact: "email",
        locale: "en",
      };
      const result = await measure("finalize", () =>
        admin.mutation("intake:finalize", {
          tokenHash,
          draft,
          acknowledged: true,
          randomHex: randomBytes(16).toString("hex"),
        }),
      );
      if (!result) return;
      submitted++;
      const retry = await measure("finalize", () =>
        admin.mutation("intake:finalize", {
          tokenHash,
          draft,
          acknowledged: true,
          randomHex: randomBytes(16).toString("hex"),
        }),
      );
      if (retry?.number !== result.number) mismatches++;
      await measure("lookup", async () => {
        const r = await admin.mutation("intake:lookup", {
          number: result.number,
          ip: "load-" + seq,
          shard: seq % 16,
        });
        if (!r || r.status !== "received") throw Error();
        return r;
      });
    })();
    pending.add(task);
    task.finally(() => pending.delete(task));
    await sleep(60000 / rpm);
  }
  await Promise.all(pending);
}
console.log(
  "Running isolated capacity exercise. No credentials or report numbers will be logged.",
);
await Promise.all([
  ...Array.from({ length: visitors }, (_, i) => visitor(i)),
  ...Array.from({ length: staffCount }, (_, i) => operator(i)),
  reports(),
]);
const metrics = Object.fromEntries(
  Object.entries(samples).map(([kind, values]) => {
    values.sort((a, b) => a - b);
    return [
      kind,
      {
        requests: values.length,
        failures: failures[kind],
        p95Ms: values[Math.floor(values.length * 0.95)] ?? null,
      },
    ];
  }),
);
const total = Object.values(metrics).reduce((n, v) => n + v.requests, 0),
  failed = Object.values(failures).reduce((a, b) => a + b, 0);
const passed =
  metrics.queue.p95Ms !== null &&
  metrics.lookup.p95Ms !== null &&
  metrics.finalize.p95Ms !== null &&
  metrics.queue.p95Ms < 1000 &&
  metrics.lookup.p95Ms < 1000 &&
  metrics.finalize.p95Ms < 2000 &&
  failed / Math.max(1, total) < 0.01 &&
  mismatches === 0 &&
  submitted >= Math.floor(((seconds * rpm) / 60) * 0.99);
await mkdir("load/results", { recursive: true });
await writeFile(
  "load/results/latest.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      seconds,
      visitors,
      staffCount,
      rpm,
      metrics,
      submitted,
      mismatches,
      passed,
      scope:
        "CDN and backend only; excludes auth, bot checks, maps, photos and live subscriptions",
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ metrics, submitted, mismatches, passed }, null, 2),
);
if (!passed) process.exitCode = 1;
