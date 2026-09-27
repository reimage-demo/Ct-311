import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "Remove expired drafts and rate buckets",
  { minutes: 15 },
  internal.intake.cleanup,
  {},
);
export default crons;
