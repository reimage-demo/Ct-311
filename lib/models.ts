import type { Draft, Status } from "./domain";
export type Id<T extends string> = string & { readonly __table?: T };
export type Staff = {
  _id: string;
  subject: string;
  name: string;
  role: "staff" | "admin";
  active: boolean;
  version: number;
};
export type Report = Omit<
  Draft,
  "name" | "email" | "phone" | "preferredContact"
> & {
  _id: string;
  number: string;
  status: Status;
  assignee?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  locationNeedsReview: boolean;
};
export type Contact = Pick<
  Draft,
  "name" | "email" | "phone" | "preferredContact"
>;
export type Audit = {
  _id: string;
  actor: string;
  kind: string;
  body: string;
  at: number;
};
export type Detail = {
  report: Report;
  contact: Contact;
  files: { id: string; name: string; size: number }[];
};
export type Doc<T extends "staff" | "reports"> = T extends "staff"
  ? Staff
  : Report;
export type Page<T> = { page: T[]; cursor: string | null };
