import { query, mutation, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { statusV } from "./schema";
import { requireStaff, fail } from "./lib/security";
import { transitions } from "../lib/domain";
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const s = await ctx.db
      .query("staff")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .unique();
    return s?.active ? s : null;
  },
});
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(statusV),
    serviceId: v.optional(v.string()),
    assignee: v.optional(v.id("staff")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await requireStaff(ctx);
    const page = {
      ...a.paginationOpts,
      numItems: Math.min(a.paginationOpts.numItems, 50),
    };
    if ((a.search?.length ?? 0) > 100) fail("INVALID_SEARCH");
    if (a.search?.trim())
      return await ctx.db
        .query("reports")
        .withSearchIndex("search", (q) => {
          let s = q.search("searchText", a.search!.trim());
          if (a.status) s = s.eq("status", a.status);
          if (a.serviceId) s = s.eq("serviceId", a.serviceId);
          if (a.assignee) s = s.eq("assignee", a.assignee);
          return s;
        })
        .paginate(page);
    // A single primary indexed filter keeps pages bounded; the UI exposes one filter at a time.
    if (a.status)
      return await ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", a.status!))
        .order("desc")
        .paginate(page);
    if (a.serviceId)
      return await ctx.db
        .query("reports")
        .withIndex("by_service", (q) => q.eq("serviceId", a.serviceId!))
        .order("desc")
        .paginate(page);
    if (a.assignee)
      return await ctx.db
        .query("reports")
        .withIndex("by_assignee", (q) => q.eq("assignee", a.assignee!))
        .order("desc")
        .paginate(page);
    return await ctx.db
      .query("reports")
      .withIndex("by_created")
      .order("desc")
      .paginate(page);
  },
});
export const members = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.db.query("staff").take(200);
  },
});
export const detail = query({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const report = await ctx.db.get(id);
    if (!report) return null;
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_report", (q) => q.eq("reportId", id))
      .unique();
    const files = await ctx.db
      .query("attachments")
      .withIndex("by_report", (q) => q.eq("reportId", id))
      .take(6);
    return {
      report,
      contact,
      files: files.map((f) => ({ id: f._id, name: f.name, size: f.size })),
    };
  },
});
export const activity = query({
  args: { id: v.id("reports"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, a) => {
    await requireStaff(ctx);
    return await ctx.db
      .query("audit")
      .withIndex("by_report", (q) => q.eq("reportId", a.id))
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(a.paginationOpts.numItems, 30),
      });
  },
});
export const update = mutation({
  args: {
    id: v.id("reports"),
    version: v.number(),
    status: statusV,
    assignee: v.optional(v.id("staff")),
    reason: v.string(),
    locationReviewed: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const actor = await requireStaff(ctx);
    const r = await ctx.db.get(a.id);
    if (!r) fail("NOT_FOUND");
    if (r.version !== a.version) fail("CONFLICT");
    if (a.reason.trim().length < 3 || a.reason.length > 2000)
      fail("REASON_REQUIRED");
    if (a.status !== r.status && !transitions[r.status].includes(a.status))
      fail("INVALID_TRANSITION");
    if (a.assignee) {
      const member = await ctx.db.get(a.assignee);
      if (!member?.active) fail("INVALID_ASSIGNEE");
    }
    if (a.status === "assigned" && !a.assignee) fail("INVALID_ASSIGNEE");
    const now = Date.now();
    const history =
      a.status === r.status
        ? r.history
        : [...r.history, { status: a.status, at: now }].slice(-100);
    await ctx.db.patch(a.id, {
      status: a.status,
      assignee: a.assignee,
      updatedAt: now,
      version: r.version + 1,
      history,
      locationNeedsReview: a.locationReviewed ? false : r.locationNeedsReview,
    });
    await ctx.db.insert("audit", {
      reportId: a.id,
      actor: actor.name,
      kind: "update",
      body: `${r.status} → ${a.status}\n${a.reason.trim()}${a.assignee !== r.assignee ? "\nAssignment changed." : ""}${a.locationReviewed ? "\nLocation reviewed." : ""}`,
      at: now,
    });
  },
});
export const note = mutation({
  args: { id: v.id("reports"), body: v.string() },
  handler: async (ctx, a) => {
    const actor = await requireStaff(ctx);
    if (!(await ctx.db.get(a.id))) fail("NOT_FOUND");
    if (!a.body.trim() || a.body.length > 2000) fail("INVALID_NOTE");
    await ctx.db.insert("audit", {
      reportId: a.id,
      actor: actor.name,
      kind: "note",
      body: a.body.trim(),
      at: Date.now(),
    });
  },
});
export const saveMember = mutation({
  args: {
    id: v.optional(v.id("staff")),
    subject: v.string(),
    name: v.string(),
    role: v.union(v.literal("staff"), v.literal("admin")),
    active: v.boolean(),
  },
  handler: async (ctx, a) => {
    const actor = await requireStaff(ctx, true);
    if (
      !/^user_[A-Za-z0-9]+$/.test(a.subject) ||
      a.name.trim().length < 2 ||
      a.name.length > 100
    )
      fail("INVALID_MEMBER");
    if (a.id === actor._id && (!a.active || a.role !== "admin"))
      fail("SELF_DEMOTION");
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_subject", (q) => q.eq("subject", a.subject))
      .unique();
    if (existing && existing._id !== a.id) fail("DUPLICATE_MEMBER");
    const data = {
      subject: a.subject,
      name: a.name.trim(),
      role: a.role,
      active: a.active,
    };
    if (a.id) {
      if (!(await ctx.db.get(a.id))) fail("NOT_FOUND");
      await ctx.db.patch(a.id, data);
    } else {
      if ((await ctx.db.query("staff").take(200)).length >= 200)
        fail("STAFF_LIMIT");
      await ctx.db.insert("staff", data);
    }
    await ctx.db.insert("audit", {
      actor: actor.name,
      kind: "membership",
      body: `${data.name}: ${data.role}; ${data.active ? "active" : "disabled"}`,
      at: Date.now(),
    });
  },
});
export const bootstrap = internalMutation({
  args: {},
  handler: async (ctx) => {
    const subject = process.env.BOOTSTRAP_ADMIN_SUBJECT;
    if (!subject || !/^user_[A-Za-z0-9]+$/.test(subject))
      fail("SETUP_REQUIRED");
    if (await ctx.db.query("staff").first()) fail("ALREADY_CONFIGURED");
    await ctx.db.insert("staff", {
      subject,
      name: "Portal administrator",
      role: "admin",
      active: true,
    });
    await ctx.db.insert("audit", {
      actor: "Setup",
      kind: "membership",
      body: "Initial administrator provisioned.",
      at: Date.now(),
    });
  },
});
