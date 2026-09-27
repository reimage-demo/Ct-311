import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const count = Number(process.argv[2] || 12);
if (!Number.isInteger(count) || count < 1 || count > 100000)
  throw Error("Provide a count between 1 and 100000.");
if (process.env.CONFIRM_DEMO_SEED !== "yes")
  throw Error(
    "Set CONFIRM_DEMO_SEED=yes and verify CONVEX_DEPLOYMENT points to your isolated demo.",
  );
for (let offset = 0; offset < count; offset += 100) {
  const size = Math.min(100, count - offset);
  execFileSync(
    "npx",
    [
      "convex",
      "run",
      "seed:batch",
      JSON.stringify({
        offset,
        count: size,
        numbers: Array.from({ length: size }, () =>
          randomBytes(16).toString("hex"),
        ),
      }),
    ],
    { stdio: "inherit" },
  );
}
