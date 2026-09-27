import type { Env } from "./types";
import {
  ApiError,
  boundedBody,
  checkOrigin,
  fail,
  id,
  ipKey,
  jsonBody,
  limit,
  parse,
  requireStaff,
} from "./security";
import { publicRequest } from "./intake";
import { cleanup, upload } from "./photos";
import { staffRequest } from "./staff";
export { RateGate } from "./rate-gate";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
function headers(response: Response, privateResponse: boolean) {
  const res = new Response(response.body, response);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );
  res.headers.set("Strict-Transport-Security", "max-age=31536000");
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://maps.geoapify.com; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  if (privateResponse) res.headers.set("Cache-Control", "private, no-store");
  return res;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname,
      privatePath =
        path.startsWith("/api/") ||
        path === "/admin" ||
        path.startsWith("/admin/");
    try {
      if (path.startsWith("/api/")) {
        checkOrigin(req, env);
        if (!env.DB || !env.RATE_GATE || !env.PHOTOS)
          fail("SETUP_REQUIRED", 503);
        const ip = await ipKey(req, env);
        // Throttle before JWT parsing, challenge verification, reading bodies, or D1.
        await limit(env, "edge:" + ip, 1200, 60000);
        let response: Response;
        if (path.startsWith("/api/public/") && req.method === "POST") {
          response = json(
            await publicRequest(
              env,
              path.slice("/api/public/".length),
              await jsonBody(req),
              ip,
            ),
          );
        } else if (path === "/api/upload" && req.method === "POST")
          response = json(await upload(env, req));
        else if (path.startsWith("/api/staff/") && req.method === "POST") {
          const actor = await requireStaff(req, env);
          await limit(env, "staff:" + actor._id, 180, 60000);
          response = json(
            await staffRequest(
              env,
              actor,
              path.slice("/api/staff/".length),
              await jsonBody(req),
            ),
          );
        } else if (path.startsWith("/api/photo/") && req.method === "GET") {
          const actor = await requireStaff(req, env);
          await limit(env, "photo:" + actor._id, 120, 60000);
          const photoId = parse(id, path.slice("/api/photo/".length));
          const file = await env.DB.prepare(
            "SELECT objectKey FROM attachments WHERE _id=? AND reportId IS NOT NULL AND state='ready'",
          )
            .bind(photoId)
            .first<{ objectKey: string }>();
          if (!file) fail("NOT_FOUND", 404);
          const object = await env.PHOTOS.get(file.objectKey);
          if (!object) fail("NOT_FOUND", 404);
          // Recheck after storage latency; an access revocation must block delivery.
          await requireStaff(req, env);
          response = new Response(object.body as unknown as ReadableStream, {
            headers: {
              "Content-Type": "image/webp",
              "Content-Disposition": 'inline; filename="report-photo.webp"',
            },
          });
        } else fail("NOT_FOUND", 404);
        return headers(response, true);
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        fail("METHOD_NOT_ALLOWED", 405);
      if (privatePath) await requireStaff(req, env);
      if (!env.ASSETS) fail("SETUP_REQUIRED", 503);
      return headers(
        (await env.ASSETS.fetch(req as never)) as unknown as Response,
        privatePath,
      );
    } catch (error) {
      // Never log request bodies, report numbers, tokens, SQL errors, or PII.
      const known = error instanceof ApiError;
      if (!known)
        console.error(
          JSON.stringify({
            event: "request_failed",
            area: path.startsWith("/api/") ? "api" : "page",
          }),
        );
      const response = headers(
        json(
          { error: known ? error.code : "SERVICE_UNAVAILABLE" },
          known ? error.status : 503,
        ),
        true,
      );
      if (known && error.status === 429)
        response.headers.set("Retry-After", "60");
      return response;
    }
  },
  async scheduled(_: unknown, env: Env) {
    await cleanup(env);
  },
};
