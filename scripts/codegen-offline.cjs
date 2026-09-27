// Generate local type bindings with the installed Convex generator. This does
// not connect to a deployment or claim the backend was deployed.
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(
  path.dirname(require.resolve("convex/package.json")),
  "dist/cjs/cli/codegen_templates",
);
const { apiCodegen } = require(path.join(root, "api.js"));
const files = fs
  .readdirSync("convex")
  .filter(
    (f) =>
      f.endsWith(".ts") &&
      !["schema.ts", "auth.config.ts", "crons.ts", "http.ts"].includes(f),
  );
const result = apiCodegen(files);
fs.writeFileSync("convex/_generated/api.d.ts", result.DTS);
fs.writeFileSync("convex/_generated/api.js", result.JS);
console.log(
  "Generated typed local bindings. Run convex dev to provision and validate a deployment.",
);
