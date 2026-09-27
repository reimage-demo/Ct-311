import { it, expect, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import {internal} from '../convex/_generated/api';
import {hash} from '../convex/lib/security';
import sharp from 'sharp';
const modules = import.meta.glob("../convex/**/*.ts");
it('uploads, normalizes and serves a finalized photo only to active staff',async()=>{
 vi.stubEnv('APP_ORIGIN','https://demo.example');const t=convexTest(schema,modules);const token='c'.repeat(64),tokenHash=await hash(token);
 await t.mutation(internal.intake.start,{tokenHash,ip:'test',shard:0});
 const image=await sharp({create:{width:30,height:30,channels:3,background:'#fff'}}).png().toBuffer();
 const response=await t.fetch('/upload',{method:'POST',headers:{Origin:'https://demo.example',Authorization:'Bearer '+token,'X-Upload-Slot':'00000000-0000-0000-0000-000000000001','X-File-Name':'test.png','Content-Type':'image/png'},body:new Uint8Array(image)});
 expect(response.status).toBe(200);const attachment=await response.json();
 await t.mutation(internal.intake.finalize,{tokenHash,draft:{serviceId:'pothole',description:'Synthetic image test report.',address:'550 Main Street, Hartford',landmark:'',locationMethod:'manual',name:'Demo Resident',email:'test@example.invalid',phone:'',preferredContact:'email',locale:'en'},randomHex:'f'.repeat(32),acknowledged:true});
 expect((await t.fetch('/photo?id='+attachment.id)).status).toBe(403);
 const staffId=await t.run(ctx=>ctx.db.insert('staff',{subject:'user_photo',name:'Photo tester',role:'staff',active:true}));
 const authenticated=t.withIdentity({subject:'user_photo'});const result=await authenticated.fetch('/photo?id='+attachment.id);
 expect(result.status).toBe(200);expect(result.headers.get('Cache-Control')).toContain('no-store');expect(result.headers.get('Content-Type')).toBe('image/webp');expect((await result.arrayBuffer()).byteLength).toBeGreaterThan(0);
 await t.run(ctx=>ctx.db.patch(staffId,{active:false}));expect((await authenticated.fetch('/photo?id='+attachment.id)).status).toBe(403);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("requires configured secrets, never treating missing secrets as valid", async () => {
  const t = convexTest(schema, modules);
  vi.stubEnv("GATEWAY_SECRET", "");
  expect(
    (
      await t.fetch("/gateway", {
        method: "POST",
        headers: { Authorization: "Bearer " },
        body: "{}",
      })
    ).status,
  ).toBe(401);
});
it("does not allow a mismatched upload origin", async () => {
  vi.stubEnv("APP_ORIGIN", "https://demo.example");
  const t = convexTest(schema, modules);
  expect(
    (
      await t.fetch("/upload", {
        method: "OPTIONS",
        headers: { Origin: "https://attacker.example" },
      })
    ).status,
  ).toBe(403);
  const allowed = await t.fetch("/upload", {
    method: "OPTIONS",
    headers: { Origin: "https://demo.example" },
  });
  expect(allowed.status).toBe(204);
  expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
    "https://demo.example",
  );
});
it("rejects unverified requests even through the authenticated gateway", async () => {
  vi.stubEnv("APP_ORIGIN", "https://demo.example");
  vi.stubEnv("GATEWAY_SECRET", "gateway");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile");
  const t = convexTest(schema, modules);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ success: false })),
  );
  const res = await t.fetch("/gateway", {
    method: "POST",
    headers: { Authorization: "Bearer gateway" },
    body: JSON.stringify({
      operation: "start",
      ip: "a".repeat(64),
      body: { token: "b".repeat(64), verification: "invalid" },
    }),
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "VERIFICATION_FAILED" });
  expect(await t.run((ctx) => ctx.db.query("sessions").collect())).toHaveLength(
    0,
  );
});
it("rejects verification tokens for a different hostname or action", async () => {
  vi.stubEnv("APP_ORIGIN", "https://demo.example");
  vi.stubEnv("GATEWAY_SECRET", "gateway");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile");
  const t = convexTest(schema, modules);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          success: true,
          hostname: "attacker.example",
          action: "start",
        }),
      ),
  );
  const res = await t.fetch("/gateway", {
    method: "POST",
    headers: { Authorization: "Bearer gateway" },
    body: JSON.stringify({
      operation: "start",
      ip: "a".repeat(64),
      body: { token: "b".repeat(64), verification: "anything" },
    }),
  });
  expect(res.status).toBe(400);
  expect(await t.run((ctx) => ctx.db.query("sessions").collect())).toHaveLength(
    0,
  );
});
