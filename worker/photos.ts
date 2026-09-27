import type { Env } from "./types";
import { boundedBody, fail, hex, limit, parse, session } from "./security";
import { z } from "zod";
import { MAX_PHOTO_BYTES, MAX_PIXELS } from "../lib/domain";
export function imageSignature(bytes: Uint8Array) {
  const same = (at: number, a: number[]) =>
    a.every((n, i) => bytes[at + i] === n);
  if (same(0, [255, 216, 255])) return "jpeg";
  if (same(0, [137, 80, 78, 71, 13, 10, 26, 10])) return "png";
  if (same(0, [82, 73, 70, 70]) && same(8, [87, 69, 66, 80])) return "webp";
  fail("INVALID_FILE");
}
export async function normalize(env: Env, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) fail("INVALID_FILE");
  imageSignature(bytes);
  if (!env.IMAGES) fail("SETUP_REQUIRED", 503);
  try {
    const stream = () => new Blob([bytes as BlobPart]).stream();
    const info = await env.IMAGES.info(stream() as never);
    if (
      !("width" in info) ||
      !["image/jpeg", "image/png", "image/webp"].includes(info.format) ||
      !info.width ||
      !info.height ||
      info.width * info.height > MAX_PIXELS
    )
      fail("INVALID_FILE");
    const response = (
      await env.IMAGES.input(stream() as never)
        .transform({ width: 2400, height: 2400, fit: "scale-down" })
        .output({ format: "image/webp", quality: 85, anim: false })
    ).response();
    // WebP output discards metadata. Never serve or store the original bytes.
    const result = await boundedBody(
      new Request("https://image.internal/", {
        method: "POST",
        body: response.body as unknown as BodyInit,
        duplex: "half",
      } as RequestInit),
      MAX_PHOTO_BYTES,
    );
    if (imageSignature(result) !== "webp") fail("INVALID_FILE");
    return result;
  } catch (e) {
    if (String(e).includes("SETUP_REQUIRED")) throw e;
    fail("INVALID_FILE");
  }
}
export async function upload(env: Env, req: Request) {
  const s = await session(
    env,
    req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
  );
  if (s.reportId) fail("ALREADY_SUBMITTED");
  await limit(env, "upload:" + s.tokenHash, 12, 60000);
  const slot = parse(z.string().uuid(), req.headers.get("x-upload-slot"));
  let name: string;
  try {
    name = decodeURIComponent(req.headers.get("x-file-name") || "Photo").slice(
      0,
      120,
    );
  } catch {
    fail("INVALID_FILE");
  }
  const old = await env.DB.prepare(
    "SELECT _id,state FROM attachments WHERE sessionHash=? AND slot=?",
  )
    .bind(s.tokenHash, slot)
    .first<{ _id: string; state: string }>();
  if (old?.state === "ready") return { id: old._id };
  if (old) fail("UPLOAD_IN_PROGRESS", 409);
  const id = hex(16),
    key = "photos/" + id + ".webp",
    now = Date.now();
  try {
    await env.DB.prepare(
      "INSERT INTO attachments(_id,sessionHash,slot,state,objectKey,createdAt,leaseUntil,name) VALUES(?,?,?,'reserved',?,?,?,?)",
    )
      .bind(id, s.tokenHash, slot, key, now, now + 120000, name)
      .run();
  } catch (e) {
    if (String(e).includes("UPLOAD_LIMIT")) fail("UPLOAD_LIMIT");
    if (String(e).includes("UNIQUE")) fail("UPLOAD_IN_PROGRESS", 409);
    throw e;
  }
  let ready = false;
  try {
    const clean = await normalize(env, await boundedBody(req, MAX_PHOTO_BYTES));
    await env.PHOTOS.put(key, clean, {
      httpMetadata: { contentType: "image/webp" },
    });
    const updated = await env.DB.prepare(
      "UPDATE attachments SET state='ready',size=? WHERE _id=? AND state='reserved' AND leaseUntil>? AND reportId IS NULL AND EXISTS(SELECT 1 FROM sessions WHERE tokenHash=? AND reportId IS NULL AND expiresAt>?) RETURNING _id",
    )
      .bind(clean.length, id, Date.now(), s.tokenHash, Date.now())
      .first();
    if (!updated) fail("SESSION_EXPIRED");
    ready = true;
    return { id };
  } finally {
    if (!ready) {
      // This request owns a unique object key, never one reused by a retry.
      await env.DB.prepare(
        "UPDATE attachments SET state='deleting' WHERE _id=? AND reportId IS NULL",
      )
        .bind(id)
        .run();
      await env.PHOTOS.delete(key);
      await env.DB.prepare(
        "DELETE FROM attachments WHERE _id=? AND reportId IS NULL AND state='deleting'",
      )
        .bind(id)
        .run();
    }
  }
}
export async function cleanup(env: Env) {
  const now = Date.now();
  const files = await env.DB.prepare(
    "SELECT _id,objectKey FROM attachments WHERE reportId IS NULL AND (state='deleting' OR (state='reserved' AND leaseUntil<?) OR sessionHash IN (SELECT tokenHash FROM sessions WHERE expiresAt<? ORDER BY expiresAt LIMIT 100)) LIMIT 100",
  )
    .bind(now, now)
    .all<{ _id: string; objectKey: string }>();
  for (const f of files.results) {
    const row = await env.DB.prepare(
      "UPDATE attachments SET state='deleting' WHERE _id=? AND reportId IS NULL RETURNING _id",
    )
      .bind(f._id)
      .first();
    if (row) {
      await env.PHOTOS.delete(f.objectKey);
      await env.DB.prepare(
        "DELETE FROM attachments WHERE _id=? AND reportId IS NULL AND state='deleting'",
      )
        .bind(f._id)
        .run();
    }
  }
  await env.DB.prepare(
    "DELETE FROM sessions WHERE tokenHash IN (SELECT tokenHash FROM sessions s WHERE expiresAt<? AND NOT EXISTS(SELECT 1 FROM attachments a WHERE a.sessionHash=s.tokenHash AND a.reportId IS NULL) ORDER BY expiresAt LIMIT 100)",
  )
    .bind(now)
    .run();
  // Bounded crash-recovery sweep. Old objects with no DB reference are orphans.
  const cursor = await env.DB.prepare(
    "SELECT value FROM maintenance WHERE key='r2-cursor'",
  ).first<{ value: string }>();
  const page = await env.PHOTOS.list({
    prefix: "photos/",
    limit: 100,
    cursor: cursor?.value || undefined,
  });
  for (const object of page.objects) {
    if (object.uploaded.getTime() > now - 86400000) continue;
    const linked = await env.DB.prepare(
      "SELECT _id FROM attachments WHERE objectKey=?",
    )
      .bind(object.key)
      .first();
    if (!linked) await env.PHOTOS.delete(object.key);
  }
  await env.DB.prepare(
    "INSERT INTO maintenance(key,value) VALUES('r2-cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(page.truncated ? page.cursor : "")
    .run();
}
