import type { DurableObjectState } from "@cloudflare/workers-types";
// One object per keyed identity and operation. Transactional global enforcement,
// independent of the location receiving the request; no D1 hot counter.
export class RateGate {
  constructor(private state: DurableObjectState) {}
  async fetch(request: Request) {
    const { capacity, windowMs } = (await request.json()) as {
      capacity: number;
      windowMs: number;
    };
    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000 ||
      !Number.isInteger(windowMs) ||
      windowMs < 1000 ||
      windowMs > 86400000
    )
      return new Response(null, { status: 400 });
    const now = Date.now();
    const allowed = await this.state.storage.transaction(async (tx) => {
      const previous = await tx.get<{ tokens: number; at: number }>("bucket");
      const tokens = previous
        ? Math.min(
            capacity,
            previous.tokens + ((now - previous.at) * capacity) / windowMs,
          )
        : capacity;
      if (tokens < 1) return false;
      await tx.put("bucket", { tokens: tokens - 1, at: now });
      await tx.setAlarm(now + windowMs * 2);
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
  async alarm() {
    await this.state.storage.deleteAll();
  }
}
