import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { draftV } from "./schema";
import { consume, fail, session } from "./lib/security";
import {
  draftErrors,
  normalizeNumber,
  publicProjection,
  formatNumber,
  MAX_PHOTOS,
} from "../lib/domain";
import { getService } from "../lib/services";
import { internal } from "./_generated/api";
export const start = internalMutation({
  args: { tokenHash: v.string(), ip: v.string(), shard: v.number() },
  handler: async (ctx, a) => {
    await consume(ctx, "start-ip:" + a.ip, 10, 3600000);
    await consume(ctx, "start-global:" + a.shard, 30, 60000);
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", a.tokenHash))
      .unique();
    if (existing) {
      if (existing.expiresAt < Date.now()) fail("SESSION_EXPIRED");
      return { expiresAt: existing.expiresAt };
    }
    const now = Date.now();
    await ctx.db.insert("sessions", {
      tokenHash: a.tokenHash,
      createdAt: now,
      expiresAt: now + 86400000,
      uploadCount: 0,
    });
    return { expiresAt: now + 86400000 };
  },
});
export const authorize = internalMutation({
  args: {
    tokenHash: v.string(),
    operation: v.union(v.literal("map"), v.literal("submit")),
  },
  handler: async (ctx, a) => {
    const s = await session(ctx, a.tokenHash);
    await consume(
      ctx,
      a.operation + ":" + s._id,
      a.operation === "map" ? 30 : 10,
      60000,
    );
    if (a.operation === "map")
      await consume(ctx, "maps-hour:" + s._id, 120, 3600000);
    return { id: s._id, reportId: s.reportId };
  },
});
export const lookup = internalMutation({
  args: { number: v.string(), ip: v.string(), shard: v.number() },
  handler: async (ctx, a) => {
    await consume(ctx, "lookup:" + a.ip, 20, 60000);
    await consume(ctx, "lookup-global:" + a.shard, 100, 60000);
    const number = normalizeNumber(a.number);
    if (!/^[A-F0-9]{32}$/.test(number)) return null;
    const report = await ctx.db
      .query("reports")
      .withIndex("by_number", (q) => q.eq("number", formatNumber(number)))
      .unique();
    return report ? publicProjection(report) : null;
  },
});
export const reserve = internalMutation({
  args: { tokenHash: v.string(), slot: v.string(), name: v.string() },
  handler: async (ctx, a) => {
    const s = await session(ctx, a.tokenHash);
    if (s.reportId) fail("ALREADY_SUBMITTED");
    if (!/^[a-f0-9-]{36}$/.test(a.slot)) fail("INVALID_FILE");
    await consume(ctx, "upload:" + s._id, 12, 60000);
    const existing = await ctx.db
      .query("attachments")
      .withIndex("by_session_slot", (q) =>
        q.eq("sessionId", s._id).eq("slot", a.slot),
      )
      .unique();
    if (existing?.state === "ready") return { id: existing._id, ready: true };
    if (existing) fail("UPLOAD_IN_PROGRESS");
    const count = (
      await ctx.db
        .query("attachments")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .take(MAX_PHOTOS + 1)
    ).length;
    if (count >= MAX_PHOTOS || s.uploadCount >= 24) fail("UPLOAD_LIMIT");
    await ctx.db.patch(s._id, { uploadCount: s.uploadCount + 1 });
    const id = await ctx.db.insert("attachments", {
      sessionId: s._id,
      slot: a.slot,
      name: a.name.slice(0, 120),
      state: "reserved",
      createdAt: Date.now(),
    });
    return { id, ready: false };
  },
});
export const setRaw = internalMutation({
  args: { id: v.id("attachments"), rawId: v.id("_storage") },
  handler: async (ctx, a) => {
    const file = await ctx.db.get(a.id);
    if (!file) fail("INVALID_FILE");
    await ctx.db.patch(a.id, { rawId: a.rawId });
  },
});
export const complete = internalMutation({
  args: {
    id: v.id("attachments"),
    storageId: v.id("_storage"),
    size: v.number(),
  },
  handler: async (ctx, a) => {
    const file = await ctx.db.get(a.id);
    if (!file) fail("INVALID_FILE");
    const s = await ctx.db.get(file.sessionId);
    if (!s || s.expiresAt < Date.now() || s.reportId) fail("SESSION_EXPIRED");
    await ctx.db.patch(a.id, {
      state: "ready",
      storageId: a.storageId,
      size: a.size,
      mime: "image/webp",
      rawId: undefined,
    });
  },
});
export const cancel = internalMutation({
  args: { id: v.id("attachments") },
  handler: async (ctx, a) => {
    const f = await ctx.db.get(a.id);
    if (!f || f.reportId) return;
    if (f.rawId) await ctx.storage.delete(f.rawId);
    if (f.storageId) await ctx.storage.delete(f.storageId);
    await ctx.db.delete(a.id);
  },
});
export const remove = internalMutation({
  args: { tokenHash: v.string(), slot: v.string() },
  handler: async (ctx, a) => {
    const s = await session(ctx, a.tokenHash);
    if (s.reportId) fail("ALREADY_SUBMITTED");
    const f = await ctx.db
      .query("attachments")
      .withIndex("by_session_slot", (q) =>
        q.eq("sessionId", s._id).eq("slot", a.slot),
      )
      .unique();
    if (!f) return;
    if (f.storageId) await ctx.storage.delete(f.storageId);
    if (f.rawId) await ctx.storage.delete(f.rawId);
    await ctx.db.delete(f._id);
  },
});
export const finalize = internalMutation({
  args: {
    tokenHash: v.string(),
    draft: draftV,
    randomHex: v.string(),
    acknowledged: v.boolean(),
  },
  handler: async (ctx, a) => {
    if (!a.acknowledged) fail("ACKNOWLEDGMENT_REQUIRED");
    const s = await session(ctx, a.tokenHash);
    if (s.reportId) {
      const old = await ctx.db.get(s.reportId);
      if (!old) fail("INVALID_REPORT");
      return { number: old.number };
    }
    if (draftErrors(a.draft).length || !getService(a.draft.serviceId))
      fail("INVALID_REPORT");
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_session", (q) => q.eq("sessionId", s._id))
      .take(MAX_PHOTOS + 1);
    if (
      attachments.length > MAX_PHOTOS ||
      attachments.some((f) => f.state !== "ready")
    )
      fail("PHOTOS_PENDING");
    const number = formatNumber(a.randomHex);
    if (
      await ctx.db
        .query("reports")
        .withIndex("by_number", (q) => q.eq("number", number))
        .unique()
    )
      fail("RETRY");
    const { name, email, phone, preferredContact, ...details } = a.draft;
    const now = Date.now();
    const reportId = await ctx.db.insert("reports", {
      ...details,
      number,
      locationNeedsReview: true,
      status: "received",
      createdAt: now,
      updatedAt: now,
      version: 1,
      history: [{ status: "received", at: now }],
      searchText: [number, details.address, name, email, phone].join(" "),
    });
    await ctx.db.insert("contacts", {
      reportId,
      name,
      email,
      phone,
      preferredContact,
    });
    for (const f of attachments) await ctx.db.patch(f._id, { reportId });
    await ctx.db.insert("audit", {
      reportId,
      actor: "Constituent",
      kind: "received",
      body: "Test report submitted through the public form.",
      at: now,
    });
    await ctx.db.patch(s._id, { reportId });
    return { number };
  },
});
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(50);
    for (const s of expired) {
      if (!s.reportId) {
        const files = await ctx.db
          .query("attachments")
          .withIndex("by_session", (q) => q.eq("sessionId", s._id))
          .take(7);
        for (const f of files) {
          if (f.storageId) await ctx.storage.delete(f.storageId);
          if (f.rawId) await ctx.storage.delete(f.rawId);
          await ctx.db.delete(f._id);
        }
      }
      await ctx.db.delete(s._id);
    }
    const rates = await ctx.db
      .query("limits")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(100);
    for (const row of rates) await ctx.db.delete(row._id);
    if (expired.length === 50 || rates.length === 100)
      await ctx.scheduler.runAfter(1000, internal.intake.cleanup, {});
  },
});
export const attachment = internalQuery({
  args: { id: v.id("attachments") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});
