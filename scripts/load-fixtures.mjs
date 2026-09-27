// Operator-only provisioning of test sessions; no bypass exists in the Worker.
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const count = Number(process.argv[2] || 3000);
if (
  process.env.CONFIRM_DEMO_SEED !== "yes" ||
  !Number.isInteger(count) ||
  count < 1 ||
  count > 10000
)
  throw Error("Set CONFIRM_DEMO_SEED=yes; pass 1–10000 sessions.");
const now = Date.now(),
  tokens = [],
  sql = [];
for (let i = 0; i < count; i++) {
  const token = randomBytes(32).toString("hex");
  tokens.push(token);
  sql.push(
    `INSERT INTO sessions(tokenHash,createdAt,expiresAt) VALUES('${createHash("sha256").update(token).digest("hex")}',${now},${now + 3600000});`,
  );
}
await mkdir("load/results", { recursive: true });
await writeFile("load/results/sessions.sql", sql.join("\n"));
await writeFile("load/results/sessions.json", JSON.stringify(tokens), {
  mode: 0o600,
});
console.log(
  "Created one-hour synthetic session credentials. Apply sessions.sql only to the isolated load database; protect/delete sessions.json.",
);
