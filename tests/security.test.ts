import { describe, it, expect, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { hash } from "../convex/lib/security";
import {
  draftErrors,
  formatNumber,
  normalizeNumber,
  MAX_PHOTOS,
  type Draft,
} from "../lib/domain";
import { services } from "../lib/services";
const modules = import.meta.glob("../convex/**/*.ts");
const draft: Draft = {
  serviceId: "pothole",
  description: "A synthetic pothole for testing only.",
  address: "550 Main Street, Hartford, CT",
  landmark: "",
  locationMethod: "manual",
  name: "Demo Resident",
  email: "demo@example.invalid",
  phone: "",
  preferredContact: "email",
  locale: "en",
};
const token = "a".repeat(64),
  hex = "0123456789abcdef0123456789abcdef";
async function setup() {
  const t = convexTest(schema, modules);
  const tokenHash = await hash(token);
  await t.mutation(internal.intake.start, { tokenHash, ip: "ip", shard: 0 });
  return { t, tokenHash };
}
async function submitted() {
  const { t, tokenHash } = await setup();
  const receipt = await t.mutation(internal.intake.finalize, {
    tokenHash,
    draft,
    randomHex: hex,
    acknowledged: true,
  });
  const report = await t.run((ctx) => ctx.db.query("reports").first());
  return { t, tokenHash, receipt, report: report! };
}
async function staff(
  t: ReturnType<typeof convexTest<typeof schema.tables>>,
  role: "admin" | "staff" = "staff",
  subject = "user_test",
) {
  const id = await t.run((ctx) =>
    ctx.db.insert("staff", { subject, name: "Test staff", role, active: true }),
  );
  return { id, as: t.withIdentity({ subject }) };
}
afterEach(() => vi.unstubAllEnvs());
describe("service and form contracts", () => {
  it("contains all 43 bilingual services with unique ids", () => {
    expect(services).toHaveLength(43);
    expect(new Set(services.map((s) => s.id)).size).toBe(43);
    expect(
      services.every(
        (s) => s.title.en && s.title.es && s.description.en && s.description.es,
      ),
    ).toBe(true);
  });
  it("validates contacts, coordinates and issue content", () => {
    expect(draftErrors(draft)).toEqual([]);
    expect(draftErrors({ ...draft, email: "", phone: "" })).toContain(
      "contact",
    );
    expect(draftErrors({ ...draft, latitude: 0, longitude: 0 })).toContain(
      "coordinates",
    );
    expect(draftErrors({ ...draft, phone: "123", email: "bad" })).toEqual(
      expect.arrayContaining(["phone", "email"]),
    );
    expect(draftErrors({ ...draft, description: "short" })).toContain(
      "description",
    );
  });
  it("retains all 128 random bits in printable numbers", () => {
    expect(normalizeNumber(formatNumber(hex))).toBe(hex.toUpperCase());
    expect(normalizeNumber(formatNumber(hex)).length).toBe(32);
  });
});
describe("report privacy and consistency", () => {
  it("finalizes once and returns the same receipt on retry", async () => {
    const { t, tokenHash, receipt } = await submitted();
    const retry = await t.mutation(internal.intake.finalize, {
      tokenHash,
      draft,
      randomHex: "f".repeat(32),
      acknowledged: true,
    });
    expect(retry).toEqual(receipt);
    expect(
      await t.run((ctx) => ctx.db.query("reports").collect()),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("contacts").collect()),
    ).toHaveLength(1);
  });
  it("lookup reveals only status and dates, never private fields", async () => {
    const { t, receipt } = await submitted();
    const result = await t.mutation(internal.intake.lookup, {
      number: receipt.number,
      ip: "ip",
      shard: 1,
    });
    expect(Object.keys(result!).sort()).toEqual([
      "createdAt",
      "history",
      "status",
      "updatedAt",
    ]);
    expect(JSON.stringify(result)).not.toContain("Demo Resident");
    expect(
      await t.mutation(internal.intake.lookup, {
        number: formatNumber("b".repeat(32)),
        ip: "ip",
        shard: 1,
      }),
    ).toBeNull();
  });
  it("rejects missing, expired, and invented sessions", async () => {
    const { t, tokenHash } = await setup();
    await expect(
      t.mutation(internal.intake.finalize, {
        tokenHash: "other",
        draft,
        randomHex: hex,
        acknowledged: true,
      }),
    ).rejects.toThrow("SESSION_EXPIRED");
    await t.run(async (ctx) => {
      const s = await ctx.db.query("sessions").first();
      await ctx.db.patch(s!._id, { expiresAt: 0 });
    });
    await expect(
      t.mutation(internal.intake.finalize, {
        tokenHash,
        draft,
        randomHex: hex,
        acknowledged: true,
      }),
    ).rejects.toThrow("SESSION_EXPIRED");
  });
  it("limits lookup attempts transactionally", async () => {
    const { t } = await setup();
    for (let i = 0; i < 20; i++)
      await t.mutation(internal.intake.lookup, {
        number: "invalid",
        ip: "one-ip",
        shard: 2,
      });
    await expect(
      t.mutation(internal.intake.lookup, {
        number: "invalid",
        ip: "one-ip",
        shard: 2,
      }),
    ).rejects.toThrow("RATE_LIMITED");
  });
  it("rejects unknown categories even with a valid session", async () => {
    const { t, tokenHash } = await setup();
    await expect(
      t.mutation(internal.intake.finalize, {
        tokenHash,
        draft: { ...draft, serviceId: "invented" },
        randomHex: hex,
        acknowledged: true,
      }),
    ).rejects.toThrow("INVALID_REPORT");
  });
});
describe("staff authorization", () => {
  it("denies anonymous and uninvited users access to report detail and queue", async () => {
    const { t, report } = await submitted();
    await expect(t.query(api.staff.detail, { id: report._id })).rejects.toThrow(
      "UNAUTHORIZED",
    );
    await expect(
      t
        .withIdentity({ subject: "user_stranger" })
        .query(api.staff.detail, { id: report._id }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      t.query(api.staff.list, {
        paginationOpts: { numItems: 25, cursor: null },
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
  it("blocks staff from granting roles and blocks disabled members immediately", async () => {
    const { t, report } = await submitted();
    const { id, as } = await staff(t);
    expect(
      (await as.query(api.staff.detail, { id: report._id }))?.contact?.email,
    ).toBe(draft.email);
    await expect(
      as.mutation(api.staff.saveMember, {
        subject: "user_other",
        name: "Other staff",
        role: "admin",
        active: true,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await t.run((ctx) => ctx.db.patch(id, { active: false }));
    await expect(
      as.query(api.staff.detail, { id: report._id }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(as.query(internal.media.authorize, {})).rejects.toThrow(
      "FORBIDDEN",
    );
  });
  it("updates public progress while keeping the reason private", async () => {
    const { t, report, receipt } = await submitted();
    const { as } = await staff(t);
    await as.mutation(api.staff.update, {
      id: report._id,
      version: 1,
      status: "under_review",
      reason: "Private staff note",
    });
    const publicResult = await t.mutation(internal.intake.lookup, {
      number: receipt.number,
      ip: "ip",
      shard: 0,
    });
    expect(publicResult?.status).toBe("under_review");
    expect(JSON.stringify(publicResult)).not.toContain("Private staff note");
    const log = await as.query(api.staff.activity, {
      id: report._id,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(log.page.some((e) => e.body.includes("Private staff note"))).toBe(
      true,
    );
  });
  it("detects stale edits and rejects invalid transitions", async () => {
    const { t, report } = await submitted();
    const { as } = await staff(t);
    await expect(
      as.mutation(api.staff.update, {
        id: report._id,
        version: 1,
        status: "resolved",
        reason: "Skipping review",
      }),
    ).rejects.toThrow("INVALID_TRANSITION");
    await as.mutation(api.staff.update, {
      id: report._id,
      version: 1,
      status: "under_review",
      reason: "Reviewing",
    });
    await expect(
      as.mutation(api.staff.update, {
        id: report._id,
        version: 1,
        status: "under_review",
        reason: "Old edit",
      }),
    ).rejects.toThrow("CONFLICT");
  });
  it("allows admins to manage staff but prevents self-demotion", async () => {
    const { t } = await setup();
    const { id, as } = await staff(t, "admin");
    await as.mutation(api.staff.saveMember, {
      subject: "user_new",
      name: "New member",
      role: "staff",
      active: true,
    });
    await expect(
      as.mutation(api.staff.saveMember, {
        id,
        subject: "user_test",
        name: "Test staff",
        role: "staff",
        active: true,
      }),
    ).rejects.toThrow("SELF_DEMOTION");
  });
});
describe("uploads and cleanup", () => {
  it("limits a session to six uploads and rejects duplicate in-flight slots", async () => {
    const { t, tokenHash } = await setup();
    const slots = Array.from(
      { length: 7 },
      (_, i) => `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`,
    );
    for (let i = 0; i < MAX_PHOTOS; i++)
      await t.mutation(internal.intake.reserve, {
        tokenHash,
        slot: slots[i],
        name: "test.jpg",
      });
    await expect(
      t.mutation(internal.intake.reserve, {
        tokenHash,
        slot: slots[0],
        name: "test.jpg",
      }),
    ).rejects.toThrow("UPLOAD_IN_PROGRESS");
    await expect(
      t.mutation(internal.intake.reserve, {
        tokenHash,
        slot: slots[6],
        name: "test.jpg",
      }),
    ).rejects.toThrow("UPLOAD_LIMIT");
    await expect(
      t.mutation(internal.intake.finalize, {
        tokenHash,
        draft,
        randomHex: hex,
        acknowledged: true,
      }),
    ).rejects.toThrow("PHOTOS_PENDING");
  });
  it("rejects attachment removal by another session", async () => {
    const { t, tokenHash } = await setup();
    const { id } = await t.mutation(internal.intake.reserve, {
      tokenHash,
      slot: "00000000-0000-0000-0000-000000000000",
      name: "test.jpg",
    });
    const other = await hash("b".repeat(64));
    await t.mutation(internal.intake.start, {
      tokenHash: other,
      ip: "other",
      shard: 1,
    });
    await t.mutation(internal.intake.remove, {
      tokenHash: other,
      slot: "00000000-0000-0000-0000-000000000000",
    });
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
  });
  it("does not delete finalized reports when sessions expire", async () => {
    const { t, report } = await submitted();
    await t.run(async (ctx) => {
      const s = await ctx.db.query("sessions").first();
      await ctx.db.patch(s!._id, { expiresAt: 0 });
    });
    await t.mutation(internal.intake.cleanup, {});
    expect(await t.run((ctx) => ctx.db.get(report._id))).not.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("sessions").collect()),
    ).toHaveLength(0);
  });
  it("rejects direct gateway and photo requests without authorization", async () => {
    const { t } = await setup();
    expect(
      (await t.fetch("/gateway", { method: "POST", body: "{}" })).status,
    ).toBe(401);
    expect((await t.fetch("/photo?id=anything")).status).toBe(403);
    expect(
      (await t.fetch("/upload", { method: "POST", body: "not a photo" }))
        .status,
    ).toBe(403);
  });
});
