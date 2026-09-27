import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const count = Number(process.argv[2] || 12);
if (
  process.env.CONFIRM_DEMO_SEED !== "yes" ||
  !Number.isInteger(count) ||
  count < 1 ||
  count > 100000
)
  throw Error(
    "Set CONFIRM_DEMO_SEED=yes and use a count between 1 and 100000.",
  );
await mkdir("load/results", { recursive: true });
const now = Date.now(),
  lines = [];
for (let i = 0; i < count; i++) {
  const id = randomBytes(16).toString("hex"),
    token = randomBytes(32).toString("hex"),
    number =
      "HFD-" +
      randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g).join("-"),
    at = now - i * 1000;
  lines.push(
    `INSERT INTO sessions(tokenHash,createdAt,expiresAt) VALUES('${token}',${at},${now + 86400000});`,
  );
  lines.push(
    `INSERT INTO reports(_id,sessionHash,number,serviceId,description,address,landmark,locationMethod,locale,status,createdAt,updatedAt,lastActor,lastReason) VALUES('${id}','${token}','${number}','pothole','SYNTHETIC capacity record ${i}','Main Street test location ${i}','','manual','en','received',${at},${at},'Synthetic seed','Synthetic capacity test only.');`,
  );
  lines.push(
    `INSERT INTO contacts VALUES('${id}','Synthetic Resident','test@example.invalid','','email');`,
  );
}
await writeFile("load/results/seed.sql", lines.join("\n"));
console.log(
  `Created ${count} synthetic records in load/results/seed.sql. Apply only to an isolated demo D1 database. No remote writes performed.`,
);
