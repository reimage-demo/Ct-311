import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export const statusV = v.union(
  v.literal("received"),
  v.literal("under_review"),
  v.literal("assigned"),
  v.literal("in_progress"),
  v.literal("needs_information"),
  v.literal("resolved"),
  v.literal("closed"),
);
export const draftV = v.object({
  serviceId: v.string(),
  description: v.string(),
  address: v.string(),
  landmark: v.string(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  locationMethod: v.union(
    v.literal("manual"),
    v.literal("search"),
    v.literal("pin"),
    v.literal("gps"),
  ),
  name: v.string(),
  email: v.string(),
  phone: v.string(),
  preferredContact: v.union(v.literal("email"), v.literal("phone")),
  locale: v.union(v.literal("en"), v.literal("es")),
});
export default defineSchema({
  reports: defineTable({
    number: v.string(),
    serviceId: v.string(),
    description: v.string(),
    address: v.string(),
    landmark: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    locationMethod: v.string(),
    locationNeedsReview: v.boolean(),
    locale: v.string(),
    status: statusV,
    assignee: v.optional(v.id("staff")),
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.number(),
    history: v.array(v.object({ status: statusV, at: v.number() })),
    searchText: v.string(),
  })
    .index("by_number", ["number"])
    .index("by_created", ["createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_service", ["serviceId", "createdAt"])
    .index("by_assignee", ["assignee", "createdAt"])
    .searchIndex("search", {
      searchField: "searchText",
      filterFields: ["status", "serviceId", "assignee"],
    }),
  contacts: defineTable({
    reportId: v.id("reports"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    preferredContact: v.string(),
  }).index("by_report", ["reportId"]),
  sessions: defineTable({
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    uploadCount: v.number(),
    reportId: v.optional(v.id("reports")),
  })
    .index("by_token", ["tokenHash"])
    .index("by_expiry", ["expiresAt"]),
  attachments: defineTable({
    sessionId: v.id("sessions"),
    slot: v.string(),
    state: v.union(v.literal("reserved"), v.literal("ready")),
    storageId: v.optional(v.id("_storage")),
    rawId: v.optional(v.id("_storage")),
    reportId: v.optional(v.id("reports")),
    createdAt: v.number(),
    name: v.string(),
    size: v.optional(v.number()),
    mime: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_report", ["reportId"])
    .index("by_session_slot", ["sessionId", "slot"]),
  staff: defineTable({
    subject: v.string(),
    name: v.string(),
    role: v.union(v.literal("staff"), v.literal("admin")),
    active: v.boolean(),
  }).index("by_subject", ["subject"]),
  audit: defineTable({
    reportId: v.optional(v.id("reports")),
    actor: v.string(),
    kind: v.string(),
    body: v.string(),
    at: v.number(),
  })
    .index("by_report", ["reportId", "at"])
    .index("by_time", ["at"]),
  limits: defineTable({
    key: v.string(),
    tokens: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expiry", ["expiresAt"]),
});
