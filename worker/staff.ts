import { z } from "zod";
import type { Env } from "./types";
import type { Report, Staff, Contact, Audit } from "../lib/models";
import { activeActor, adminActor, fail, hex, id, parse } from "./security";
import { statuses, transitions } from "../lib/domain";
import { getService } from "../lib/services";
const statusSchema = z.enum(statuses);
const cursorSchema = z
  .object({ at: z.number().int().nonnegative(), id })
  .strict();
function cursor(value?: string) {
  if (!value) return undefined;
  try {
    return parse(cursorSchema, JSON.parse(atob(value)));
  } catch {
    fail("INVALID_CURSOR");
  }
}
const encode = (r: { at: number; id: string }) => btoa(JSON.stringify(r));
const reportFields =
  "_id,number,serviceId,description,address,landmark,latitude,longitude,locationMethod,locationNeedsReview,locale,status,assignee,createdAt,updatedAt,version";
function report(row: Report) {
  return {
    ...row,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    assignee: row.assignee ?? undefined,
    locationNeedsReview: !!row.locationNeedsReview,
  };
}
const cleanStaff = (s: Staff): Staff => ({
  _id: s._id,
  subject: s.subject,
  name: s.name,
  role: s.role,
  active: !!s.active,
  version: s.version,
});
export async function staffRequest(
  env: Env,
  actor: Staff,
  operation: string,
  input: unknown,
) {
  if (operation === "me") {
    parse(z.object({}).strict(), input);
    return cleanStaff(actor);
  }
  if (operation === "members") {
    parse(z.object({}).strict(), input);
    const result = await env.DB.prepare(
      "SELECT _id,subject,name,role,active,version FROM staff ORDER BY name LIMIT 200",
    ).all<Staff>();
    return result.results.map(cleanStaff);
  }
  if (operation === "list") {
    const a = parse(
      z
        .object({
          cursor: z.string().max(300).nullable().optional(),
          limit: z.number().int().min(1).max(50).default(25),
          status: statusSchema.optional(),
          serviceId: z.string().max(80).optional(),
          assignee: id.optional(),
          search: z.string().max(100).optional(),
        })
        .strict(),
      input,
    );
    if ([a.status, a.serviceId, a.assignee].filter(Boolean).length > 1)
      fail("ONE_FILTER_ONLY");
    if (a.serviceId && !getService(a.serviceId)) fail("INVALID_REQUEST");
    const c = cursor(a.cursor || undefined),
      params: (string | number)[] = [],
      where: string[] = [];
    if (a.status) {
      where.push("r.status=?");
      params.push(a.status);
    }
    if (a.serviceId) {
      where.push("r.serviceId=?");
      params.push(a.serviceId);
    }
    if (a.assignee) {
      where.push("r.assignee=?");
      params.push(a.assignee);
    }
    const searching = !!a.search?.trim();
    let from = "reports r";
    if (a.search?.trim()) {
      const terms = a.search.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) || [];
      if (!terms.length) return { page: [], cursor: null };
      // FTS syntax is built only from letters/digits; user input is never SQL syntax.
      from = "report_search JOIN reports r ON r._id=report_search.reportId";
      where.push("report_search MATCH ?");
      params.push(terms.map((t) => '"' + t + '"*').join(" AND "));
    }
    if (c) {
      if (searching) {
        where.push("report_search.rowid<?");
        params.push(c.at);
      } else {
        where.push("(r.createdAt,r._id)<(?,?)");
        params.push(c.at, c.id);
      }
    }
    const sql = `SELECT ${reportFields
      .split(",")
      .map((f) => "r." + f)
      .join(
        ",",
      )}${searching ? ",report_search.rowid AS searchOrder" : ""} FROM ${from} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${searching ? "report_search.rowid DESC" : "r.createdAt DESC,r._id DESC"} LIMIT ?`;
    const rows = (
      await env.DB.prepare(sql)
        .bind(...params, a.limit + 1)
        .all<Report & { searchOrder?: number }>()
    ).results;
    const more = rows.length > a.limit,
      page = rows.slice(0, a.limit).map(report),
      last = page.at(-1);
    return {
      page,
      cursor:
        more && last
          ? encode({
              at: searching ? rows[a.limit - 1].searchOrder! : last.createdAt,
              id: last._id,
            })
          : null,
    };
  }
  if (operation === "detail") {
    const a = parse(z.object({ id }).strict(), input);
    const r = await env.DB.prepare(
      `SELECT ${reportFields} FROM reports WHERE _id=?`,
    )
      .bind(a.id)
      .first<Report>();
    if (!r) return null;
    const contact = await env.DB.prepare(
      "SELECT name,email,phone,preferredContact FROM contacts WHERE reportId=?",
    )
      .bind(a.id)
      .first<Contact>();
    const files = await env.DB.prepare(
      "SELECT _id AS id,name,size FROM attachments WHERE reportId=? AND state='ready' LIMIT 6",
    )
      .bind(a.id)
      .all();
    return { report: report(r), contact, files: files.results };
  }
  if (operation === "activity") {
    const a = parse(
        z
          .object({
            id,
            cursor: z.string().max(300).nullable().optional(),
            limit: z.number().int().min(1).max(30).default(20),
          })
          .strict(),
        input,
      ),
      c = cursor(a.cursor || undefined);
    const rows = (
      await env.DB.prepare(
        `SELECT _id,actor,kind,body,at FROM audit WHERE reportId=? ${c ? "AND (at,_id)<(?,?)" : ""} ORDER BY at DESC,_id DESC LIMIT ?`,
      )
        .bind(a.id, ...(c ? [c.at, c.id] : []), a.limit + 1)
        .all<Audit>()
    ).results;
    const page = rows.slice(0, a.limit),
      last = page.at(-1);
    return {
      page,
      cursor:
        rows.length > a.limit && last
          ? encode({ at: last.at, id: last._id })
          : null,
    };
  }
  if (operation === "update") {
    const a = parse(
      z
        .object({
          id,
          version: z.number().int().positive(),
          status: statusSchema,
          assignee: id.optional(),
          reason: z.string().trim().min(3).max(2000),
          locationReviewed: z.boolean().optional(),
        })
        .strict(),
      input,
    );
    const r = await env.DB.prepare(
      "SELECT status,assignee,version FROM reports WHERE _id=?",
    )
      .bind(a.id)
      .first<Report>();
    if (!r) fail("NOT_FOUND", 404);
    if (r.version !== a.version) fail("CONFLICT", 409);
    if (r.status !== a.status && !transitions[r.status].includes(a.status))
      fail("INVALID_TRANSITION");
    const assignmentChanged = (r.assignee || undefined) !== a.assignee;
    if (assignmentChanged && actor.role !== "admin") fail("FORBIDDEN", 403);
    if (a.status === "assigned" && !a.assignee) fail("INVALID_ASSIGNEE");
    const now = Date.now();
    const updated = await env.DB.prepare(
      `UPDATE reports SET status=?,assignee=?,updatedAt=?,version=version+1,locationNeedsReview=CASE WHEN ? THEN 0 ELSE locationNeedsReview END,lastActor=?,lastReason=? WHERE _id=? AND version=? AND ${assignmentChanged ? adminActor : activeActor} AND (? IS NULL OR EXISTS(SELECT 1 FROM staff WHERE _id=? AND active=1)) RETURNING _id`,
    )
      .bind(
        a.status,
        a.assignee || null,
        now,
        a.locationReviewed ? 1 : 0,
        actor.name,
        `${r.status} → ${a.status}\n${a.reason}${assignmentChanged ? "\nAssignment changed." : ""}${a.locationReviewed ? "\nLocation reviewed." : ""}`,
        a.id,
        a.version,
        actor._id,
        a.assignee || null,
        a.assignee || null,
      )
      .first();
    if (!updated) fail("CONFLICT", 409);
    return { ok: true };
  }
  if (operation === "note") {
    const a = parse(
      z.object({ id, body: z.string().trim().min(1).max(2000) }).strict(),
      input,
    );
    const result = await env.DB.prepare(
      `INSERT INTO audit(_id,reportId,actor,kind,body,at) SELECT ?,?,?,'note',?,? WHERE EXISTS(SELECT 1 FROM reports WHERE _id=?) AND ${activeActor} RETURNING _id`,
    )
      .bind(hex(16), a.id, actor.name, a.body, Date.now(), a.id, actor._id)
      .first();
    if (!result) fail("FORBIDDEN", 403);
    return { ok: true };
  }
  if (operation === "saveMember") {
    if (actor.role !== "admin") fail("FORBIDDEN", 403);
    const a = parse(
      z
        .object({
          id: id.optional(),
          version: z.number().int().positive().optional(),
          subject: z
            .string()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z0-9_-]+$/),
          name: z.string().trim().min(2).max(100),
          role: z.enum(["staff", "admin"]),
          active: z.boolean(),
        })
        .strict(),
      input,
    );
    if (
      a.id === actor._id &&
      (!a.active || a.role !== "admin" || a.subject !== actor.subject)
    )
      fail("SELF_DEMOTION");
    let result;
    try {
      if (a.id) {
        if (!a.version) fail("CONFLICT", 409);
        result = await env.DB.prepare(
          `UPDATE staff SET name=?,role=?,active=?,version=version+1,lastActor=? WHERE _id=? AND subject=? AND version=? AND ${adminActor} RETURNING _id`,
        )
          .bind(
            a.name,
            a.role,
            a.active ? 1 : 0,
            actor.name,
            a.id,
            a.subject,
            a.version,
            actor._id,
          )
          .first();
      } else {
        result = await env.DB.prepare(
          `INSERT INTO staff(_id,subject,name,role,active,lastActor) SELECT ?,?,?,?,?,? WHERE ${adminActor} AND (SELECT count(*) FROM staff)<200 RETURNING _id`,
        )
          .bind(
            hex(16),
            a.subject,
            a.name,
            a.role,
            a.active ? 1 : 0,
            actor.name,
            actor._id,
          )
          .first();
      }
    } catch (e) {
      if (String(e).includes("UNIQUE")) fail("DUPLICATE_MEMBER");
      throw e;
    }
    if (!result) fail("CONFLICT", 409);
    return { ok: true };
  }
  fail("NOT_FOUND", 404);
}
