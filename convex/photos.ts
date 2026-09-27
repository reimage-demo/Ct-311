"use node";
import sharp from "sharp";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { MAX_PIXELS, MAX_PHOTO_BYTES } from "../lib/domain";
import { fail } from "./lib/security";
export const normalize = internalAction({
  args: { rawId: v.id("_storage") },
  handler: async (
    ctx,
    { rawId },
  ): Promise<{
    storageId: import("./_generated/dataModel").Id<"_storage">;
    size: number;
  }> => {
    const blob = await ctx.storage.get(rawId);
    if (!blob || blob.size > MAX_PHOTO_BYTES) fail("INVALID_FILE");
    const bytes = Buffer.from(await blob.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
    if (!jpeg && !png && !webp) fail("INVALID_FILE");
    try {
      const input = sharp(bytes, {
        limitInputPixels: MAX_PIXELS,
        failOn: "warning",
        animated: false,
      });
      const meta = await input.metadata();
      if (
        !meta.format ||
        !["jpeg", "png", "webp"].includes(meta.format) ||
        (meta.pages ?? 1) > 1
      )
        fail("INVALID_FILE");
      const normalized = await input
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array(normalized)], { type: "image/webp" }),
      );
      return { storageId, size: normalized.length };
    } catch {
      fail("INVALID_FILE");
    }
  },
});
