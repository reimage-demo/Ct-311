import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { fail } from "./lib/security";
import { services } from "../lib/services";
import { formatNumber } from "../lib/domain";
export const batch = internalMutation({
  args: { offset: v.number(), count: v.number(), numbers: v.array(v.string()) },
  handler: async (ctx, a) => {
    if (process.env.DEMO_SEED_ENABLED !== "true") fail("SEED_DISABLED");
    if (a.count < 1 || a.count > 100 || a.numbers.length !== a.count)
      fail("INVALID_BATCH");
    const ids = [];
    for (let j = 0; j < a.count; j++) {
      const i = a.offset + j;
      const hex = a.numbers[j];
      if (!/^[a-f0-9]{32}$/.test(hex)) fail("INVALID_NUMBER");
      const number = formatNumber(hex);
      if (
        await ctx.db
          .query("reports")
          .withIndex("by_number", (q) => q.eq("number", number))
          .unique()
      )
        continue;
      const s = services[i % services.length];
      const now = Date.now() - i * 60000;
      const address = [
        "550 Main Street, Hartford, CT",
        "Main Street & Gold Street, Hartford, CT",
        "Bushnell Park, Hartford, CT",
      ][i % 3];
      const id = await ctx.db.insert("reports", {
        number,
        serviceId: s.id,
        description:
          "SYNTHETIC DEMO RECORD — " +
          s.title.en +
          ". This report does not describe a real issue.",
        address,
        landmark: "Synthetic location for testing only",
        locationMethod: "manual",
        locationNeedsReview: true,
        locale: i % 3 === 0 ? "es" : "en",
        status: "received",
        createdAt: now,
        updatedAt: now,
        version: 1,
        history: [{ status: "received", at: now }],
        searchText: `${number} ${address} Demo Resident ${i} resident${i}@example.invalid`,
      });
      await ctx.db.insert("contacts", {
        reportId: id,
        name: `Demo Resident ${i}`,
        email: `resident${i}@example.invalid`,
        phone: "",
        preferredContact: "email",
      });
      await ctx.db.insert("audit", {
        reportId: id,
        actor: "Demo seed",
        kind: "received",
        body: "Synthetic report created for demonstration.",
        at: now,
      });
      ids.push(id);
    }
    return { created: ids.length };
  },
});
