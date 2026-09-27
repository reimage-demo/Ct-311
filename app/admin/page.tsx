"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "@/lib/staff-client";
import { api } from "@/lib/staff-client";
import type { Id } from "@/lib/models";
import { services, getService } from "@/lib/services";
import { statuses, statusLabels, type Status } from "@/lib/domain";
export default function Queue() {
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [filter, setFilter] = useState(""),
    [value, setValue] = useState("");
  const members = useQuery(api.staff.members);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { results, status, loadMore } = usePaginatedQuery(
    api.staff.list,
    {
      search: debounced || undefined,
      status: filter === "status" && value ? (value as Status) : undefined,
      serviceId: filter === "service" && value ? value : undefined,
      assignee:
        filter === "assignee" && value ? (value as Id<"staff">) : undefined,
    },
    { initialNumItems: 25 },
  );
  return (
    <>
      <div className="admin-toolbar">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="queue-search">Search reports</label>
          <input
            id="queue-search"
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Report number, address, name, or contact"
          />
        </div>
        <div className="field">
          <label htmlFor="filter">Filter by</label>
          <select
            id="filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setValue("");
            }}
          >
            <option value="">All reports</option>
            <option value="status">Status</option>
            <option value="service">Service</option>
            <option value="assignee">Assignee</option>
          </select>
        </div>
        {filter && (
          <div className="field">
            <label htmlFor="filter-value">
              {filter === "service"
                ? "Service"
                : filter === "status"
                  ? "Status"
                  : "Staff member"}
            </label>
            <select
              id="filter-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">All</option>
              {filter === "status"
                ? statuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s][0]}
                    </option>
                  ))
                : filter === "service"
                  ? services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title.en}
                      </option>
                    ))
                  : members?.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                        {!m.active ? " (inactive)" : ""}
                      </option>
                    ))}
            </select>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Report queue, newest first</caption>
          <thead>
            <tr>
              <th>REPORT / RECEIVED</th>
              <th>SERVICE / LOCATION</th>
              <th>STATUS</th>
              <th>ASSIGNED TO</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r._id}>
                <td>
                  <Link href={"/admin/report?id=" + r._id}>
                    {r.number.slice(0, 13)}…
                  </Link>
                  <small>
                    {new Date(r.createdAt).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </small>
                </td>
                <td>
                  {getService(r.serviceId)?.title.en}
                  <small>{r.address}</small>
                </td>
                <td>
                  <span className="status-label" data-status={r.status}>
                    {statusLabels[r.status][0]}
                  </span>
                  {r.locationNeedsReview && <small>Verify location</small>}
                </td>
                <td>
                  {members?.find((m) => m._id === r.assignee)?.name ||
                    "Unassigned"}
                </td>
                <td>
                  <Link href={"/admin/report?id=" + r._id}>Review →</Link>
                </td>
              </tr>
            ))}
            {!results.length && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <h2>
                      {status === "LoadingFirstPage"
                        ? "Loading reports…"
                        : "No reports to display"}
                    </h2>
                    <p>
                      {status === "LoadingFirstPage"
                        ? "Retrieving the first page."
                        : "Try another search or filter. New test reports appear here after submission."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="page-count">
        <button className="text-button" onClick={() => window.dispatchEvent(new Event("staff-refresh"))}>Refresh queue</button>
        <span className="small muted">
          {results.length} reports loaded · Eastern Time
          {debounced ? " · Search ordered by newest insertion" : ""}
        </span>
        {status !== "Exhausted" && (
          <button
            className="button secondary small-button"
            disabled={status !== "CanLoadMore"}
            onClick={() => loadMore(25)}
          >
            {status === "LoadingMore" ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </>
  );
}
