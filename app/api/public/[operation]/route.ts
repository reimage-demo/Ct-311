import { createHmac } from "node:crypto";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  if (
    !["start", "lookup", "submit", "remove", "geocode", "reverse"].includes(
      operation,
    )
  )
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const origin = process.env.APP_ORIGIN;
  const backend = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (
    !origin ||
    !backend ||
    !process.env.GATEWAY_SECRET ||
    !process.env.IP_HASH_SECRET
  )
    return Response.json({ error: "SETUP_REQUIRED" }, { status: 503 });
  if (req.headers.get("origin") !== origin)
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const reader = req.body?.getReader();
  if (!reader)
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16000) {
        await reader.cancel();
        return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    // Vercel overwrites x-vercel-forwarded-for. Do not trust arbitrary client IP headers.
    const ip = process.env.VERCEL
      ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
      : "local-development";
    const hash = createHmac("sha256", process.env.IP_HASH_SECRET)
      .update(ip)
      .digest("hex");
    const response = await fetch(backend + "/gateway", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GATEWAY_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation, body: JSON.parse(text), ip: hash }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "REQUEST_FAILED" }, { status: 502 });
  }
}
