// Hosted CDN/staff/finalization load harness. Does not bypass production auth.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const {
  LOAD_BASE_URL,
  LOAD_CONFIRM,
  LOAD_SESSION_FILE,
  LOAD_STAFF_COOKIE_FILE,
} = process.env;
if (
  LOAD_CONFIRM !== "isolated-synthetic-demo" ||
  !LOAD_BASE_URL ||
  !LOAD_SESSION_FILE ||
  !LOAD_STAFF_COOKIE_FILE
)
  throw Error(
    "Read docs/OPERATIONS.md and supply isolated demo load configuration.",
  );
const base = new URL(LOAD_BASE_URL);
if (base.protocol !== "https:") throw Error("HTTPS required");
const seconds = Number(process.env.LOAD_SECONDS || 1800),
  visitors = Number(process.env.LOAD_VISITORS || 1000),
  staffCount = Number(process.env.LOAD_STAFF || 25),
  rpm = Number(process.env.LOAD_REPORTS_PER_MINUTE || 100);
if (
  ![seconds, visitors, staffCount, rpm].every(
    (n) => Number.isFinite(n) && n > 0,
  ) ||
  seconds > 1800 ||
  visitors > 1000 ||
  staffCount > 25 ||
  rpm > 100
)
  throw Error("Unsupported load bounds");
const tokens = JSON.parse(await readFile(LOAD_SESSION_FILE, "utf8")),
  cookies = JSON.parse(await readFile(LOAD_STAFF_COOKIE_FILE, "utf8"));
if (
  tokens.length < Math.ceil((seconds * rpm) / 60) ||
  cookies.length < staffCount
)
  throw Error("Insufficient synthetic sessions or distinct staff credentials");
const metrics = { page: [], queue: [], finalize: [] },
  errors = { page: 0, queue: 0, finalize: 0 },
  throttled = { page: 0, queue: 0, finalize: 0 };
let receiptMismatches = 0,
  submitted = 0;
const start = performance.now(),
  until = start + seconds * 1000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(kind, path, body, cookie) {
  const at = performance.now();
  try {
    const r = await fetch(new URL(path, base), {
      method: body ? "POST" : "GET",
      redirect: "manual",
      headers: {
        ...(body
          ? { "Content-Type": "application/json", Origin: base.origin }
          : {}),
        ...(cookie ? { Cookie: "CF_Authorization=" + cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 429) throttled[kind]++;
    if (!r.ok) throw Error("request_failed");
    return body ? await r.json() : await r.text();
  } catch {
    errors[kind]++;
    return null;
  } finally {
    metrics[kind].push(performance.now() - at);
  }
}
const jobs = [];
for (let i = 0; i < visitors; i++)
  jobs.push(
    (async () => {
      await sleep(i * 5);
      while (performance.now() < until) {
        const at = performance.now();
        await call("page", "/");
        await sleep(Math.max(0, 5000 - (performance.now() - at)));
      }
    })(),
  );
for (let i = 0; i < staffCount; i++)
  jobs.push(
    (async () => {
      await sleep(i * 100);
      while (performance.now() < until) {
        await call("queue", "/api/staff/list", { limit: 25 }, cookies[i]);
        await sleep(3000);
      }
    })(),
  );
jobs.push(
  (async () => {
    let i = 0;
    while (performance.now() < until) {
      const at = performance.now(),
        body = {
          token: tokens[i++],
          acknowledged: true,
          draft: {
            serviceId: "pothole",
            description: "SYNTHETIC hosted capacity exercise.",
            address: "Main Street, Hartford",
            landmark: "",
            locationMethod: "manual",
            name: "Synthetic Resident",
            email: "test@example.invalid",
            phone: "",
            preferredContact: "email",
            locale: "en",
          },
        };
      const first = await call("finalize", "/api/public/submit", body);
      if (first?.number) {
        submitted++;
        const retry = await call("finalize", "/api/public/submit", body);
        if (retry?.number !== first.number) receiptMismatches++;
      }
      await sleep(Math.max(0, 60000 / rpm - (performance.now() - at)));
    }
  })(),
);
await Promise.all(jobs);
const result = {
  at: new Date().toISOString(),
  seconds,
  visitors,
  staffCount,
  rpm,
  submitted,
  receiptMismatches,
  errors,
  throttled,
  metrics: Object.fromEntries(
    Object.entries(metrics).map(([k, v]) => {
      v.sort((a, b) => a - b);
      return [
        k,
        {
          requests: v.length,
          p95Ms: Math.round(v[Math.ceil(0.95 * v.length) - 1] || 0),
        },
      ];
    }),
  ),
  excluded: [
    "Turnstile/session-start",
    "public lookup challenge",
    "image upload/transformation",
    "Geoapify",
    "browser rendering",
    "Access sign-in/MFA",
  ],
};
await mkdir("load/results", { recursive: true });
await writeFile("load/results/hosted.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (
  receiptMismatches ||
  submitted < Math.floor((seconds * rpm) / 60) * 0.99 ||
  Object.values(errors).some((n) => n > 0)
)
  process.exitCode = 1;
