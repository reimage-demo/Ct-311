import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const subject = process.argv[2];
if (!subject || !/^[A-Za-z0-9_-]{1,128}$/.test(subject))
  throw Error("Pass the verified Access subject ID.");
await mkdir("load/results", { recursive: true });
await writeFile(
  "load/results/bootstrap.sql",
  `INSERT INTO staff(_id,subject,name,role,active) SELECT '${randomBytes(16).toString("hex")}','${subject}','Portal administrator','admin',1 WHERE NOT EXISTS(SELECT 1 FROM staff);\n`,
);
console.log(
  "Created load/results/bootstrap.sql. Review and apply with a trusted D1 administrator. Refuses to add an account if membership already exists.",
);
