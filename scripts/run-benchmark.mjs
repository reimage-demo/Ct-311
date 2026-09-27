import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["load/local-benchmark.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "load/results/benchmark.mjs",
});
const result = spawnSync(process.execPath, ["load/results/benchmark.mjs"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
