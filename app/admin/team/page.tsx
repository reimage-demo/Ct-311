"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@/lib/staff-client";
import { api } from "@/lib/staff-client";
import type { Doc } from "@/lib/models";
import { errorMessage } from "@/lib/client";
export default function Team() {
  const me = useQuery(api.staff.me),
    members = useQuery(api.staff.members);
  const save = useMutation(api.staff.saveMember);
  const [selected, setSelected] = useState<Doc<"staff"> | null>(null),
    [subject, setSubject] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState<"staff" | "admin">("staff"),
    [active, setActive] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (me?.role !== "admin")
    return <div className="notice">Administrator access is required.</div>;
  function edit(m: Doc<"staff">) {
    setSelected(m);
    setSubject(m.subject);
    setName(m.name);
    setRole(m.role);
    setActive(m.active);
    setMessage("");
  }
  return (
    <div className="detail-grid">
      <section>
        <h2>Staff access</h2>
        <p className="small muted">
          Allow the person in Cloudflare Access first. Then grant portal access
          using their verified Access subject ID. Disabling a membership blocks
          every subsequent database and photo request.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>ROLE</th>
                <th>ACCESS</th>
                <th>EDIT</th>
              </tr>
            </thead>
            <tbody>
              {members?.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td>
                  <td>{m.role}</td>
                  <td>{m.active ? "Active" : "Disabled"}</td>
                  <td>
                    <button className="text-button" onClick={() => edit(m)}>
                      Edit<span className="sr-only"> {m.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>{selected ? "Edit membership" : "Add invited staff"}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await save({
                id: selected?._id,
                version: selected?.version,
                subject,
                name,
                role,
                active,
              });
              setMessage("Membership saved.");
              setSelected(null);
              setSubject("");
              setName("");
              setRole("staff");
              setActive(true);
            } catch (e) {
              setMessage(errorMessage(String(e), "en"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="staff-name">Staff name</label>
            <input
              id="staff-name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="subject">Access subject ID</label>
            <input
              id="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Access user UUID"
              disabled={!!selected}
            />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "staff" | "admin")}
            >
              <option value="staff">Intake staff</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active access
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save membership"}
          </button>
          {selected && (
            <button
              type="button"
              className="text-button"
              style={{ marginLeft: 15 }}
              onClick={() => {
                setSelected(null);
                setSubject("");
                setName("");
                setRole("staff");
                setActive(true);
              }}
            >
              Cancel edit
            </button>
          )}
          {message && (
            <p className="notice" role="status" style={{ marginTop: 20 }}>
              {message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
