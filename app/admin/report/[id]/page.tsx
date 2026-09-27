"use client";
import { use, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { getService } from "@/lib/services";
import { statusLabels, transitions, type Status } from "@/lib/domain";
import { errorMessage } from "@/lib/client";
const Map = dynamic(() => import("@/components/location-map"), { ssr: false });
export default function ReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <Report id={id as Id<"reports">} />;
}
function Report({ id }: { id: Id<"reports"> }) {
  const data = useQuery(api.staff.detail, { id });
  const members = useQuery(api.staff.members);
  if (data === undefined) return <p className="loading">Loading report…</p>;
  if (!data)
    return (
      <div className="notice">
        Report not found. <Link href="/admin">Return to queue</Link>
      </div>
    );
  const { report: r, contact, files } = data;
  return (
    <>
      <Link href="/admin" className="small">
        ← Back to report queue
      </Link>
      <div className="section-title" style={{ marginTop: 25 }}>
        <h2>{getService(r.serviceId)?.title.en}</h2>
        <span className="status-label" data-status={r.status}>
          {statusLabels[r.status][0]}
        </span>
      </div>
      <p className="small" style={{ overflowWrap: "anywhere" }}>
        {r.number}
      </p>
      <div className="detail-grid">
        <div>
          <section className="detail-block">
            <h2>1. Review the report</h2>
            <p>{r.description}</p>
            <dl className="detail-list">
              <dt>Received</dt>
              <dd>
                {new Date(r.createdAt).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                })}{" "}
                ET
              </dd>
              <dt>Address</dt>
              <dd>{r.address}</dd>
              <dt>Location details</dt>
              <dd>{r.landmark || "None provided"}</dd>
              <dt>Entry method</dt>
              <dd>{r.locationMethod}</dd>
              <dt>Language</dt>
              <dd>{r.locale === "es" ? "Spanish" : "English"}</dd>
            </dl>
            {r.locationNeedsReview && (
              <div className="notice warning">
                Verify the location before assigning work. Map search uses a
                Hartford-area bounding box, not a municipal boundary
                determination.
              </div>
            )}
            {r.latitude !== undefined &&
              process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY && (
                <Map latitude={r.latitude} longitude={r.longitude} readonly />
              )}
          </section>
          <section className="detail-block">
            <h2>Contact information</h2>
            <dl className="detail-list">
              <dt>Name</dt>
              <dd>{contact?.name}</dd>
              <dt>Email</dt>
              <dd>
                {contact?.email ? (
                  <a href={"mailto:" + contact.email}>{contact.email}</a>
                ) : (
                  "Not provided"
                )}
              </dd>
              <dt>Phone</dt>
              <dd>
                {contact?.phone ? (
                  <a href={"tel:" + contact.phone}>{contact.phone}</a>
                ) : (
                  "Not provided"
                )}
              </dd>
              <dt>Preferred</dt>
              <dd>{contact?.preferredContact}</dd>
            </dl>
          </section>
          <section className="detail-block">
            <h2>Photos ({files.length})</h2>
            {!files.length ? (
              <p className="muted small">No photos attached.</p>
            ) : (
              files.map((f) => (
                <ProtectedPhoto key={f.id} id={f.id} name={f.name} />
              ))
            )}
          </section>
          <Activity id={id} />
        </div>
        <div>
          <UpdateForm report={r} members={members || []} />
          <Notes id={id} />
        </div>
      </div>
    </>
  );
}
function ProtectedPhoto({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState(false);
  return (
    <figure style={{ margin: "0 0 20px" }}>
      {error ? (
        <p className="notice error">
          Photo unavailable. Your session may have expired.
        </p>
      ) : (
        <img
          className="admin-photo"
          src={"/api/photo/" + id}
          alt={"Report attachment: " + name}
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
      <figcaption className="small muted">{name}</figcaption>
    </figure>
  );
}
function UpdateForm({
  report: r,
  members,
}: {
  report: Doc<"reports">;
  members: Doc<"staff">[];
}) {
  const update = useMutation(api.staff.update);
  const [version, setVersion] = useState(r.version),
    [status, setStatus] = useState<Status>(r.status),
    [assignee, setAssignee] = useState(r.assignee || ""),
    [reason, setReason] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const conflict = version !== r.version;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await update({
        id: r._id,
        version,
        status,
        assignee: assignee ? (assignee as Id<"staff">) : undefined,
        reason,
        locationReviewed: reviewed,
      });
      setVersion(version + 1);
      setReason("");
      setMessage("Progress saved. The public status page is up to date.");
    } catch (e) {
      setMessage(errorMessage(String(e), "en"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-block">
      <h2>2. Assign & update progress</h2>
      <p className="small muted">
        Your explanation stays in the staff activity log. Residents see only the
        status and dates.
      </p>
      {conflict && (
        <div className="notice warning">
          This report changed while you were editing.{" "}
          <button
            className="text-button"
            onClick={() => {
              setVersion(r.version);
              setStatus(r.status);
              setAssignee(r.assignee || "");
              setMessage("");
            }}
          >
            Load latest values
          </button>
        </div>
      )}
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {[r.status, ...transitions[r.status]].map((s) => (
              <option key={s} value={s}>
                {statusLabels[s][0]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="assignee">Assigned to</label>
          <select
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {members
              .filter((m) => m.active || m._id === assignee)
              .map((m) => (
                <option key={m._id} value={m._id} disabled={!m.active}>
                  {m.name}
                  {!m.active ? " (inactive)" : ""}
                </option>
              ))}
          </select>
        </div>
        {r.locationNeedsReview && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I reviewed the report location.
          </label>
        )}
        <div className="field">
          <label htmlFor="reason">Reason or resolution *</label>
          <textarea
            id="reason"
            minLength={3}
            maxLength={2000}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What changed, what happens next, or how was the issue resolved?"
          />
        </div>
        <button className="button" disabled={busy || conflict}>
          {busy ? "Saving…" : "Save progress"}
        </button>
        {message && (
          <p className="notice" role="status" style={{ marginTop: 20 }}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
function Notes({ id }: { id: Id<"reports"> }) {
  const note = useMutation(api.staff.note);
  const [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="detail-block">
      <h2>3. Add an internal note</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await note({ id, body });
            setBody("");
            setError("Note saved.");
          } catch (err) {
            setError(errorMessage(String(err), "en"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="note">Staff note</label>
          <textarea
            id="note"
            required
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <small>
            Visible only to staff. Notes cannot be edited or removed.
          </small>
        </div>
        <button className="button secondary" disabled={busy}>
          {busy ? "Saving…" : "Add note"}
        </button>
        {error && <p role="status">{error}</p>}
      </form>
    </section>
  );
}
function Activity({ id }: { id: Id<"reports"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.staff.activity,
    { id },
    { initialNumItems: 20 },
  );
  return (
    <section className="detail-block">
      <h2>Activity history</h2>
      <ul className="activity">
        {results.map((a) => (
          <li key={a._id}>
            {a.body}
            <small>
              {a.actor} ·{" "}
              {new Date(a.at).toLocaleString("en-US", {
                timeZone: "America/New_York",
              })}{" "}
              ET
            </small>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <button className="text-button" onClick={() => loadMore(20)}>
          Load earlier activity
        </button>
      )}
    </section>
  );
}
