// Local D1 data-layer exercise; this is NOT a hosted traffic acceptance test.
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { staffRequest } from "../worker/staff";
import { finalize } from "../worker/intake";
import { hex } from "../worker/security";
import type { Env } from "../worker/types";
import type { Staff } from "../lib/models";
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: "2026-09-26",
    d1Databases: ["DB"],
  }),
);
const db = await mf.getD1Database("DB");
const env = { DB: db } as unknown as Env;
try {
  let statement = "";
  for (const line of (
    await readFile("worker/migrations/0001_initial.sql", "utf8")
  ).split("\n")) {
    statement += line + "\n";
    if (
      line.trim().endsWith(";") &&
      (!statement.trim().startsWith("CREATE TRIGGER") ||
        line.trim() === "END;" ||
        (line.trim().startsWith("CREATE TRIGGER") &&
          line.trim().endsWith("END;")))
    ) {
      await db.prepare(statement).run();
      statement = "";
    }
  }
  const count = 100000,
    now = Date.now(),
    seedStart = performance.now();
  const actor: Staff = {
    _id: hex(16),
    subject: "benchmark",
    name: "Benchmark",
    role: "admin",
    active: true,
    version: 1,
  };
  await db
    .prepare(
      "INSERT INTO staff(_id,subject,name,role,active) VALUES(?,?,?,?,1)",
    )
    .bind(actor._id, actor.subject, actor.name, actor.role)
    .run();
  for (let start = 0; start < count; start += 500) {
    await db.batch([
      db
        .prepare(
          `WITH RECURSIVE n(x) AS (SELECT ? UNION ALL SELECT x+1 FROM n WHERE x<?) INSERT INTO sessions(tokenHash,createdAt,expiresAt) SELECT printf('%064x',x),?-x,? FROM n`,
        )
        .bind(start, start + 499, now, now + 86400000),
      db
        .prepare(
          `INSERT INTO reports(_id,sessionHash,number,serviceId,description,address,landmark,locationMethod,locale,status,createdAt,updatedAt,lastActor,lastReason) SELECT printf('%032x',?+(?-createdAt)),tokenHash,upper(hex(randomblob(16))),'pothole','Synthetic capacity record','Main Street','','manual','en','received',createdAt,createdAt,'Benchmark','Synthetic record' FROM sessions WHERE createdAt BETWEEN ? AND ?`,
        )
        .bind(1, now, now - start - 499, now - start),
      db
        .prepare(
          `INSERT INTO contacts SELECT _id,'Synthetic Resident','test@example.invalid','','email' FROM reports WHERE createdAt BETWEEN ? AND ?`,
        )
        .bind(now - start - 499, now - start),
    ]);
    if ((start + 500) % 25000 === 0) console.log("Seeded", start + 500);
  }
  const metrics: Record<string, number[]> = {
    queue: [],
    statusFilter: [],
    serviceFilter: [],
    search: [],
    lookup: [],
    finalize: [],
  };
  let failures = 0,
    duplicates = 0;
  const timed = async (name: string, fn: () => Promise<unknown>) => {
    const at = performance.now();
    try {
      await fn();
    } catch {
      failures++;
    }
    metrics[name].push(performance.now() - at);
  };
  const lookup = (await db
    .prepare("SELECT number FROM reports LIMIT 1")
    .first<{ number: string }>())!.number;
  for (let round = 0; round < 20; round++)
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => {
        const kind = [
          "queue",
          "statusFilter",
          "serviceFilter",
          "search",
          "lookup",
        ][i % 5];
        return timed(kind, () =>
          kind === "lookup"
            ? db
                .prepare(
                  "SELECT status,createdAt,updatedAt FROM reports WHERE number=?",
                )
                .bind(lookup)
                .first()
            : staffRequest(env, actor, "list", {
                limit: 25,
                ...(kind === "statusFilter"
                  ? { status: "received" }
                  : kind === "serviceFilter"
                    ? { serviceId: "pothole" }
                    : kind === "search"
                      ? { search: "Main" }
                      : {}),
              }),
        );
      }),
    );
  for (let wave = 0; wave < 4; wave++)
    await Promise.all(
      Array.from({ length: 25 }, async () => {
        const token = hex();
        await db
          .prepare(
            "INSERT INTO sessions(tokenHash,createdAt,expiresAt) VALUES(?,?,?)",
          )
          .bind(token, Date.now(), Date.now() + 86400000)
          .run();
        await timed("finalize", async () => {
          const draft = {
            serviceId: "pothole",
            description: "Synthetic report from benchmark.",
            address: "Main Street, Hartford",
            landmark: "",
            locationMethod: "manual" as const,
            name: "Synthetic Resident",
            email: "test@example.invalid",
            phone: "",
            preferredContact: "email" as const,
            locale: "en" as const,
          };
          const receipts = await Promise.all([
            finalize(env, token, draft),
            finalize(env, token, draft),
          ]);
          if (receipts[0].number !== receipts[1].number) duplicates++;
        });
      }),
    );
  const plans = {
    queue: await db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT _id FROM reports ORDER BY createdAt DESC,_id DESC LIMIT 25",
      )
      .all(),
    status: await db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT _id FROM reports WHERE status='received' ORDER BY createdAt DESC,_id DESC LIMIT 25",
      )
      .all(),
  };
  const report = {
    kind: "LOCAL DATA-LAYER BENCHMARK — NOT HOSTED ACCEPTANCE",
    at: new Date().toISOString(),
    seedCount: count,
    totalMs: Math.round(performance.now() - seedStart),
    concurrency: 25,
    failures,
    receiptMismatches: duplicates,
    finalReportCount: (await db
      .prepare("SELECT count(*) AS n FROM reports")
      .first<{ n: number }>())!.n,
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([k, v]) => {
        v.sort((a, b) => a - b);
        return [
          k,
          {
            samples: v.length,
            p95Ms: Math.round(v[Math.ceil(v.length * 0.95) - 1]),
            maxMs: Math.round(v.at(-1)!),
          },
        ];
      }),
    ),
    plans,
  };
  await mkdir("load/results", { recursive: true });
  await writeFile(
    "load/results/local-benchmark.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (failures || duplicates || report.finalReportCount !== 100100)
    process.exitCode = 1;
} finally {
  await mf.dispose();
}
