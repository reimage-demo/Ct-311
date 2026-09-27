import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
export function fail(code: string): never {
  throw new ConvexError(code);
}
export async function requireStaff(ctx: QueryCtx | MutationCtx, admin = false) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return fail("UNAUTHORIZED");
  const member = await ctx.db
    .query("staff")
    .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
    .unique();
  if (!member?.active || (admin && member.role !== "admin"))
    return fail("FORBIDDEN");
  // Clerk must require MFA; session tasks must finish before issuing the Convex JWT.
  return member;
}
export async function consume(
  ctx: MutationCtx,
  key: string,
  capacity: number,
  windowMs: number,
) {
  const now = Date.now();
  const row = await ctx.db
    .query("limits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const tokens = row
    ? Math.min(
        capacity,
        row.tokens + ((now - row.updatedAt) * capacity) / windowMs,
      )
    : capacity;
  if (tokens < 1) fail("RATE_LIMITED");
  const data = {
    key,
    tokens: tokens - 1,
    updatedAt: now,
    expiresAt: now + windowMs * 2,
  };
  if (row) await ctx.db.patch(row._id, data);
  else await ctx.db.insert("limits", data);
}
export async function session(ctx: QueryCtx | MutationCtx, tokenHash: string) {
  const row = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!row || row.expiresAt < Date.now()) return fail("SESSION_EXPIRED");
  return row;
}
export async function hash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
