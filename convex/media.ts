import { internalQuery } from "./_generated/server";
import { requireStaff } from "./lib/security";
export const authorize = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return true;
  },
});
