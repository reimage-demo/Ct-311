import { z } from "zod";
import type { Env } from "./types";
import {
  fail,
  hash,
  hex,
  limit,
  parse,
  session,
  token,
  verifyChallenge,
} from "./security";
import {
  draftErrors,
  formatNumber,
  normalizeNumber,
  withinHartford,
  type Draft,
  type Status,
} from "../lib/domain";
import { getService } from "../lib/services";
const challenge = z.string().min(1).max(2048);
const draftSchema = z
  .object({
    serviceId: z.string().max(80),
    description: z.string().max(4000),
    address: z.string().max(300),
    landmark: z.string().max(300),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    locationMethod: z.enum(["manual", "search", "pin", "gps"]),
    name: z.string().max(100),
    email: z.string().max(254),
    phone: z.string().max(30),
    preferredContact: z.enum(["email", "phone"]),
    locale: z.enum(["en", "es"]),
  })
  .strict();
export async function publicRequest(
  env: Env,
  operation: string,
  input: unknown,
  ip: string,
) {
  if (operation === "start") {
    const a = parse(
      z.object({ token, verification: challenge }).strict(),
      input,
    );
    await limit(env, "start:" + ip, 10, 3600000);
    await limit(
      env,
      "start-global:" + (parseInt(ip.slice(0, 2), 16) % 16),
      30,
      60000,
    );
    await verifyChallenge(env, a.verification, "start");
    const tokenHash = await hash(a.token),
      now = Date.now();
    await env.DB.prepare(
      "INSERT INTO sessions(tokenHash,createdAt,expiresAt) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM reports WHERE sessionHash=?) ON CONFLICT(tokenHash) DO NOTHING",
    )
      .bind(tokenHash, now, now + 86400000, tokenHash)
      .run();
    const s = await session(env, a.token);
    return { expiresAt: s.expiresAt };
  }
  if (operation === "lookup") {
    const a = parse(
      z
        .object({ number: z.string().max(80), verification: challenge })
        .strict(),
      input,
    );
    await limit(env, "lookup:" + ip, 20, 60000);
    await verifyChallenge(env, a.verification, "lookup");
    const number = normalizeNumber(a.number);
    if (!/^[A-F0-9]{32}$/.test(number)) return null;
    const r = await env.DB.prepare(
      "SELECT _id,status,createdAt,updatedAt FROM reports WHERE number=?",
    )
      .bind(formatNumber(number))
      .first<{
        _id: string;
        status: Status;
        createdAt: number;
        updatedAt: number;
      }>();
    if (!r) return null;
    const history = await env.DB.prepare(
      "SELECT status,at FROM audit WHERE reportId=? AND status IS NOT NULL ORDER BY at DESC,_id DESC LIMIT 100",
    )
      .bind(r._id)
      .all<{ status: Status; at: number }>();
    return {
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      history: history.results.reverse(),
    };
  }
  if (operation === "submit") {
    const a = parse(
      z
        .object({ token, draft: draftSchema, acknowledged: z.literal(true) })
        .strict(),
      input,
    );
    const s = await session(env, a.token);
    await limit(env, "submit:" + s.tokenHash, 10, 60000);
    return finalize(env, s.tokenHash, a.draft);
  }
  if (operation === "remove") {
    const a = parse(
      z.object({ token, slot: z.string().uuid() }).strict(),
      input,
    );
    const s = await session(env, a.token);
    if (s.reportId) fail("ALREADY_SUBMITTED");
    await limit(env, "remove:" + s.tokenHash, 30, 60000);
    // Tombstones remain until object deletion succeeds, so a network failure is retryable.
    const row = await env.DB.prepare(
      "UPDATE attachments SET state='deleting' WHERE sessionHash=? AND slot=? AND reportId IS NULL AND EXISTS(SELECT 1 FROM sessions WHERE tokenHash=? AND reportId IS NULL AND expiresAt>?) RETURNING _id,objectKey",
    )
      .bind(s.tokenHash, a.slot, s.tokenHash, Date.now())
      .first<{ _id: string; objectKey: string }>();
    if (row) {
      await env.PHOTOS.delete(row.objectKey);
      await env.DB.prepare(
        "DELETE FROM attachments WHERE _id=? AND state='deleting' AND reportId IS NULL",
      )
        .bind(row._id)
        .run();
    }
    return { ok: true };
  }
  if (operation === "geocode" || operation === "reverse") {
    const a = parse(
      z
        .object({
          token,
          locale: z.enum(["en", "es"]),
          query: z.string().min(3).max(200).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        })
        .strict(),
      input,
    );
    const s = await session(env, a.token);
    if (s.reportId) fail("ALREADY_SUBMITTED");
    await limit(env, "map:" + s.tokenHash, 30, 60000);
    await limit(env, "map-hour:" + s.tokenHash, 120, 3600000);
    if (!env.GEOAPIFY_API_KEY) fail("SETUP_REQUIRED", 503);
    const url = new URL(
      "https://api.geoapify.com/v1/geocode/" +
        (operation === "geocode" ? "autocomplete" : "reverse"),
    );
    url.search = new URLSearchParams({
      apiKey: env.GEOAPIFY_API_KEY,
      lang: a.locale,
      format: "json",
      limit: "5",
    }).toString();
    if (operation === "geocode") {
      if (!a.query) fail("INVALID_REQUEST");
      url.searchParams.set("text", a.query);
      url.searchParams.set("filter", "rect:-72.76,41.70,-72.60,41.82");
      url.searchParams.set("bias", "proximity:-72.6851,41.7637");
    } else {
      if (!withinHartford(a.latitude!, a.longitude!)) fail("INVALID_REQUEST");
      url.searchParams.set("lat", String(a.latitude));
      url.searchParams.set("lon", String(a.longitude));
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) fail("MAP_UNAVAILABLE", 503);
    const data = (await response.json()) as {
      results?: { formatted: string; lat: number; lon: number }[];
    };
    return {
      results: (data.results || [])
        .slice(0, 5)
        .filter((r) => withinHartford(r.lat, r.lon))
        .map((r) => ({
          address: r.formatted,
          latitude: r.lat,
          longitude: r.lon,
        })),
    };
  }
  fail("NOT_FOUND", 404);
}
export async function finalize(env: Env, tokenHash: string, d: Draft) {
  const prior = () =>
    env.DB.prepare("SELECT number FROM reports WHERE sessionHash=?")
      .bind(tokenHash)
      .first<{ number: string }>();
  const existing = await prior();
  if (existing) return existing;
  if (draftErrors(d).length || !getService(d.serviceId)) fail("INVALID_REPORT");
  const id = hex(16),
    number = formatNumber(hex(16)),
    now = Date.now();
  try {
    // D1 batch is one transaction. Triggers validate current session/file state and
    // bind all files; the contact row and search index commit in the same batch.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO reports(_id,sessionHash,number,serviceId,description,address,landmark,latitude,longitude,locationMethod,locale,status,createdAt,updatedAt,lastActor,lastReason) VALUES(?,?,?,?,?,?,?,?,?,?,?,'received',?,?,?,?)`,
      ).bind(
        id,
        tokenHash,
        number,
        d.serviceId,
        d.description,
        d.address,
        d.landmark,
        d.latitude ?? null,
        d.longitude ?? null,
        d.locationMethod,
        d.locale,
        now,
        now,
        "Constituent",
        "Test report submitted through the public form.",
      ),
      env.DB.prepare("INSERT INTO contacts VALUES(?,?,?,?,?)").bind(
        id,
        d.name,
        d.email,
        d.phone,
        d.preferredContact,
      ),
    ]);
  } catch (e) {
    const same = await prior();
    if (same) return same;
    const msg = String(e);
    if (msg.includes("PHOTOS_PENDING")) fail("PHOTOS_PENDING");
    if (msg.includes("SESSION_EXPIRED")) fail("SESSION_EXPIRED");
    throw e;
  }
  return { number };
}
