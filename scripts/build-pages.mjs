import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Build an isolated, credential-free preview without altering the server app.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = path.join(root, ".pages-build");
const basePath = process.env.PAGES_BASE_PATH || "/Ct-311";
if (!/^\/[A-Za-z0-9_-]+$/.test(basePath))
  throw Error("Invalid Pages base path");
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const entry of [
  "app",
  "components",
  "lib",
  "public",
  "package.json",
  "tsconfig.json",
  "next-env.d.ts",
])
  await cp(path.join(root, entry), path.join(stage, entry), {
    recursive: true,
  });
await symlink(
  path.join(root, "node_modules"),
  path.join(stage, "node_modules"),
  "dir",
);
await writeFile(
  path.join(stage, "next.config.ts"),
  `export default ${JSON.stringify({
    output: "export",
    trailingSlash: true,
    basePath,
    poweredByHeader: false,
    turbopack: { root },
  })};\n`,
);
const env = { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath };
for (const key of Object.keys(env)) {
  if (
    (key.startsWith("NEXT_PUBLIC_") && key !== "NEXT_PUBLIC_BASE_PATH") ||
    /^(CLERK_|CONVEX_|GATEWAY_SECRET|IP_HASH_SECRET|GEOAPIFY_|TURNSTILE_)/.test(
      key,
    )
  )
    delete env[key];
}
const result = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "build"],
  {
    cwd: stage,
    env,
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status || 1);
await writeFile(path.join(stage, "out/.nojekyll"), "");
console.log(`Static preview ready: ${path.join(stage, "out")}`);
