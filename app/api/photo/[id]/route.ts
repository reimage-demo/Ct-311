import { auth } from "@clerk/nextjs/server";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CONVEX_SITE_URL)
    return new Response(null, { status: 503 });
  const { userId, getToken } = await auth();
  if (!userId) return new Response(null, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return new Response(null, { status: 401 });
  const { id } = await params;
  const res = await fetch(
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL +
      "/photo?id=" +
      encodeURIComponent(id),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  return new Response(res.ok ? res.body : null, {
    status: res.status,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
