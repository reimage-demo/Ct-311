import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import sharp from "sharp";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
describe("image quarantine processing", () => {
  it("re-encodes real images and strips EXIF before serving", async () => {
    const t = convexTest(schema, modules);
    const input = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#123456" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Private Name" } } })
      .toBuffer();
    const rawId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(input)])),
    );
    const result = await t.action(internal.photos.normalize, { rawId });
    const saved = await t.run(async (ctx) =>
      (await ctx.storage.get(result.storageId))!.arrayBuffer(),
    );
    const meta = await sharp(Buffer.from(saved)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(64);
  });
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    "not an image",
    "%PDF-1.7",
  ])("rejects spoofed image bodies", async (body) => {
    const t = convexTest(schema, modules);
    const rawId = await t.run((ctx) =>
      ctx.storage.store(new Blob([body], { type: "image/jpeg" })),
    );
    await expect(
      t.action(internal.photos.normalize, { rawId }),
    ).rejects.toThrow("INVALID_FILE");
  });
  it("rejects truncated image signatures", async () => {
    const t = convexTest(schema, modules);
    const rawId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 0, 0])])),
    );
    await expect(
      t.action(internal.photos.normalize, { rawId }),
    ).rejects.toThrow("INVALID_FILE");
  });
  it("rejects uploads over the byte limit", async () => {
    const t = convexTest(schema, modules);
    const rawId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)])),
    );
    await expect(
      t.action(internal.photos.normalize, { rawId }),
    ).rejects.toThrow("INVALID_FILE");
  });
});
