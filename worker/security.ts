import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { Env } from "./types";
import type { Staff } from "../lib/models";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function fail(code: string, status = 400): never {
  throw new ApiError(code, status);
}
export const hex = (n = 32) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function ipKey(req: Request, env: Env) {
  if (!env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32)
    fail("SETUP_REQUIRED", 503);
  // CF-Connecting-IP is overwritten by Cloudflare at the trusted ingress. Do not
  // enable a non-Cloudflare origin or forward client-provided IP headers.
  const ip = req.headers.get("CF-Connecting-IP") || "local-shared-bucket";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.IP_HASH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function limit(
  env: Env,
  key: string,
  capacity: number,
  windowMs: number,
) {
  const gate = env.RATE_GATE.get(env.RATE_GATE.idFromName(key));
  const result = await gate.fetch("https://rate.internal/", {
    method: "POST",
    body: JSON.stringify({ capacity, windowMs }),
  });
  if (result.status === 429) fail("RATE_LIMITED", 429);
  if (!result.ok) fail("SERVICE_UNAVAILABLE", 503);
}
export async function boundedBody(req: Request, max: number) {
  if (Number(req.headers.get("content-length") || 0) > max)
    fail("PAYLOAD_TOO_LARGE", 413);
  const reader = req.body?.getReader();
  if (!reader) fail("INVALID_REQUEST");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      fail("PAYLOAD_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const b of chunks) {
    output.set(b, offset);
    offset += b.length;
  }
  return output;
}
export async function jsonBody(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail("INVALID_REQUEST");
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(req, 20000)),
    ) as unknown;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    fail("INVALID_REQUEST");
  }
}
export const id = z.string().regex(/^[a-f0-9]{32}$/);
export const token = z.string().regex(/^[a-f0-9]{64}$/);
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) fail("INVALID_REQUEST");
  return result.data;
}
export function checkOrigin(req: Request, env: Env) {
  if (!env.APP_ORIGIN || new URL(req.url).origin !== env.APP_ORIGIN)
    fail("SETUP_REQUIRED", 503);
  if (req.method !== "GET" && req.headers.get("origin") !== env.APP_ORIGIN)
    fail("FORBIDDEN", 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    fail("FORBIDDEN", 403);
}
export async function verifyChallenge(env: Env, value: string, action: string) {
  if (!env.TURNSTILE_SECRET_KEY) fail("SETUP_REQUIRED", 503);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: value,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) fail("VERIFICATION_FAILED");
  const result = (await response.json()) as {
    success?: boolean;
    hostname?: string;
    action?: string;
  };
  if (
    !result.success ||
    result.hostname !== new URL(env.APP_ORIGIN).hostname ||
    result.action !== action
  )
    fail("VERIFICATION_FAILED");
}
const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function requireStaff(
  req: Request,
  env: Env,
  admin = false,
): Promise<Staff> {
  if (
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      env.ACCESS_TEAM_DOMAIN || "",
    ) ||
    !env.ACCESS_AUD
  )
    fail("SETUP_REQUIRED", 503);
  const assertion = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || assertion.length > 12000) fail("UNAUTHORIZED", 401);
  let subject: string;
  try {
    let keys = keysets.get(env.ACCESS_TEAM_DOMAIN);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL(env.ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/certs"),
        { timeoutDuration: 5000 },
      );
      keysets.set(env.ACCESS_TEAM_DOMAIN, keys);
    }
    const { payload } = await jwtVerify(assertion, keys, {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat"],
    });
    if (
      payload.type !== "app" ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.email !== "string"
    )
      fail("UNAUTHORIZED", 401);
    subject = payload.sub;
  } catch {
    fail("UNAUTHORIZED", 401);
  }
  // Always query primary D1; do not cache this result or use a stale read replica.
  const member = await env.DB.prepare(
    "SELECT * FROM staff WHERE subject=? AND active=1",
  )
    .bind(subject)
    .first<Staff>();
  if (!member || (admin && member.role !== "admin")) fail("FORBIDDEN", 403);
  return { ...member, active: !!member.active };
}
export async function session(env: Env, value: string) {
  const tokenHash = await hash(parse(token, value));
  const s = await env.DB.prepare(
    "SELECT * FROM sessions WHERE tokenHash=? AND expiresAt>?",
  )
    .bind(tokenHash, Date.now())
    .first<{
      tokenHash: string;
      reportId: string | null;
      expiresAt: number;
      uploadCount: number;
    }>();
  if (!s) fail("SESSION_EXPIRED");
  return s;
}
// Add to every write statement so revocation racing a request still blocks the write.
export const activeActor =
  "EXISTS(SELECT 1 FROM staff WHERE _id=? AND active=1)";
export const adminActor =
  "EXISTS(SELECT 1 FROM staff WHERE _id=? AND active=1 AND role='admin')";
