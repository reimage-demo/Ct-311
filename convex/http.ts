import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hash } from "./lib/security";
import { MAX_PHOTO_BYTES, withinHartford, type Draft } from "../lib/domain";
const http = httpRouter();
const json = (data: unknown, status = 200, origin?: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {}),
    },
  });
const originAllowed = (req: Request) =>
  req.headers.get("Origin") === process.env.APP_ORIGIN;
async function boundedBody(req: Request, max: number) {
  const length = Number(req.headers.get("Content-Length") || 0);
  if (length > max) throw Error("PAYLOAD_TOO_LARGE");
  const reader = req.body?.getReader();
  if (!reader) throw Error("INVALID_REQUEST");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const b of chunks) {
    bytes.set(b, at);
    at += b.length;
  }
  return bytes;
}
const safeCode = (err: unknown) => {
  const msg = String(err instanceof Error ? err.message : err);
  return (
    [
      "RATE_LIMITED",
      "SESSION_EXPIRED",
      "INVALID_FILE",
      "UPLOAD_LIMIT",
      "PHOTOS_PENDING",
      "ALREADY_SUBMITTED",
      "UPLOAD_IN_PROGRESS",
      "PAYLOAD_TOO_LARGE",
      "INVALID_REPORT",
      "RETRY",
      "SETUP_REQUIRED",
      "VERIFICATION_FAILED",
    ].find((x) => msg.includes(x)) ?? "REQUEST_FAILED"
  );
};
async function verify(token: unknown, action: string) {
  if (!process.env.TURNSTILE_SECRET_KEY || !process.env.APP_ORIGIN)
    throw Error("SETUP_REQUIRED");
  if (typeof token !== "string" || token.length > 2048)
    throw Error("VERIFICATION_FAILED");
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const data = await res.json();
  if (
    !data.success ||
    data.action !== action ||
    data.hostname !== new URL(process.env.APP_ORIGIN).hostname
  )
    throw Error("VERIFICATION_FAILED");
}
http.route({
  path: "/gateway",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (
      !process.env.GATEWAY_SECRET ||
      req.headers.get("Authorization") !==
        `Bearer ${process.env.GATEWAY_SECRET}`
    )
      return json({ error: "UNAUTHORIZED" }, 401);
    try {
      const { operation, body, ip } = JSON.parse(
        new TextDecoder().decode(await boundedBody(req, 20000)),
      );
      if (typeof ip !== "string" || ip.length !== 64)
        throw Error("INVALID_REQUEST");
      const shard = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      if (operation === "start") {
        await verify(body.verification, "start");
        if (!/^[a-f0-9]{64}$/.test(body.token)) throw Error("INVALID_REQUEST");
        return json(
          await ctx.runMutation(internal.intake.start, {
            tokenHash: await hash(body.token),
            ip,
            shard,
          }),
        );
      }
      if (operation === "lookup") {
        await verify(body.verification, "lookup");
        if (typeof body.number !== "string" || body.number.length > 80)
          throw Error("INVALID_REQUEST");
        return json(
          await ctx.runMutation(internal.intake.lookup, {
            number: body.number,
            ip,
            shard,
          }),
        );
      }
      if (!/^[a-f0-9]{64}$/.test(body.token)) throw Error("SESSION_EXPIRED");
      const tokenHash = await hash(body.token);
      if (operation === "submit") {
        await ctx.runMutation(internal.intake.authorize, {
          tokenHash,
          operation: "submit",
        });
        const randomHex = Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        return json(
          await ctx.runMutation(internal.intake.finalize, {
            tokenHash,
            draft: body.draft as Draft,
            randomHex,
            acknowledged: body.acknowledged === true,
          }),
        );
      }
      if (operation === "remove") {
        await ctx.runMutation(internal.intake.remove, {
          tokenHash,
          slot: body.slot,
        });
        return json({ ok: true });
      }
      if (operation === "geocode" || operation === "reverse") {
        await ctx.runMutation(internal.intake.authorize, {
          tokenHash,
          operation: "map",
        });
        if (!process.env.GEOAPIFY_API_KEY) throw Error("SETUP_REQUIRED");
        const endpoint = new URL(
          "https://api.geoapify.com/v1/geocode/" +
            (operation === "geocode" ? "autocomplete" : "reverse"),
        );
        endpoint.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY);
        endpoint.searchParams.set("lang", body.locale === "es" ? "es" : "en");
        endpoint.searchParams.set("format", "json");
        endpoint.searchParams.set("limit", "5");
        if (operation === "geocode") {
          if (
            typeof body.query !== "string" ||
            body.query.length < 3 ||
            body.query.length > 200
          )
            throw Error("INVALID_REQUEST");
          endpoint.searchParams.set("text", body.query);
          endpoint.searchParams.set("filter", "rect:-72.76,41.70,-72.60,41.82");
          endpoint.searchParams.set("bias", "proximity:-72.6851,41.7637");
        } else {
          if (!withinHartford(body.latitude, body.longitude))
            throw Error("INVALID_REQUEST");
          endpoint.searchParams.set("lat", String(body.latitude));
          endpoint.searchParams.set("lon", String(body.longitude));
        }
        const result = await fetch(endpoint, {
          signal: AbortSignal.timeout(7000),
        });
        if (!result.ok) throw Error("MAP_UNAVAILABLE");
        const data = await result.json();
        return json({
          results: (data.results || [])
            .filter((r: { lat: number; lon: number }) =>
              withinHartford(r.lat, r.lon),
            )
            .map((r: { formatted: string; lat: number; lon: number }) => ({
              address: r.formatted,
              latitude: r.lat,
              longitude: r.lon,
            })),
        });
      }
      return json({ error: "INVALID_REQUEST" }, 400);
    } catch (err) {
      const code = safeCode(err);
      return json(
        { error: code },
        code === "RATE_LIMITED" ? 429 : code === "SETUP_REQUIRED" ? 503 : 400,
      );
    }
  }),
});
http.route({
  path: "/upload",
  method: "OPTIONS",
  handler: httpAction(async (_, req) =>
    originAllowed(req)
      ? new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": process.env.APP_ORIGIN!,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Authorization, Content-Type, X-Upload-Slot, X-File-Name",
            Vary: "Origin",
            "Access-Control-Max-Age": "600",
          },
        })
      : new Response(null, { status: 403 }),
  ),
});
http.route({
  path: "/upload",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!originAllowed(req)) return json({ error: "FORBIDDEN" }, 403);
    const origin = process.env.APP_ORIGIN!;
    let attachmentId: Id<"attachments"> | undefined;
    let rawId: Id<"_storage"> | undefined;
    let normalizedId: Id<"_storage"> | undefined;
    try {
      const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
      if (!token || !/^[a-f0-9]{64}$/.test(token))
        throw Error("SESSION_EXPIRED");
      const reservation = await ctx.runMutation(internal.intake.reserve, {
        tokenHash: await hash(token),
        slot: req.headers.get("X-Upload-Slot") || "",
        name: decodeURIComponent(req.headers.get("X-File-Name") || "Photo"),
      });
      attachmentId = reservation.id;
      if (reservation.ready) return json({ id: attachmentId }, 200, origin);
      const bytes = await boundedBody(req, MAX_PHOTO_BYTES);
      rawId = await ctx.storage.store(
        new Blob([bytes], { type: "application/octet-stream" }),
      );
      await ctx.runMutation(internal.intake.setRaw, {
        id: attachmentId,
        rawId,
      });
      const normalized = await ctx.runAction(internal.photos.normalize, {
        rawId,
      });
      normalizedId = normalized.storageId;
      await ctx.runMutation(internal.intake.complete, {
        id: attachmentId,
        ...normalized,
      });
      await ctx.storage.delete(rawId);
      rawId = undefined;
      normalizedId = undefined;
      return json({ id: attachmentId }, 200, origin);
    } catch (err) {
      if (normalizedId) await ctx.storage.delete(normalizedId);
      if (rawId) await ctx.storage.delete(rawId);
      if (attachmentId)
        await ctx.runMutation(internal.intake.cancel, { id: attachmentId });
      const code = safeCode(err);
      return json({ error: code }, code === "RATE_LIMITED" ? 429 : 400, origin);
    }
  }),
});
http.route({
  path: "/photo",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      await ctx.runQuery(internal.media.authorize, {});
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return json({ error: "NOT_FOUND" }, 404);
      const file = await ctx.runQuery(internal.intake.attachment, {
        id: id as Id<"attachments">,
      });
      if (!file?.reportId || !file.storageId)
        return json({ error: "NOT_FOUND" }, 404);
      const blob = await ctx.storage.get(file.storageId);
      if (!blob) return json({ error: "NOT_FOUND" }, 404);
      return new Response(blob, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": 'inline; filename="report-photo.webp"',
        },
      });
    } catch {
      return json({ error: "FORBIDDEN" }, 403);
    }
  }),
});
export default http;
