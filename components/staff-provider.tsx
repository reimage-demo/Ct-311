"use client";
import { Component, type ReactNode } from "react";
import Link from "next/link";
import { StaffSetup } from "./staff-setup";
import { api, useQuery } from "@/lib/staff-client";
class StaffErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <section className="container page-body">
          <div className="notice error" role="alert">
            <h1>Staff access interrupted</h1>
            <p>
              Your session, membership, or connection has changed. Sign in again
              or contact your administrator.
            </p>
            <a className="button" href="/cdn-cgi/access/logout">
              Sign out and reconnect
            </a>
          </div>
        </section>
      );
    return this.props.children;
  }
}
export function StaffProvider({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_BACKEND_ENABLED !== "true") return <StaffSetup />;
  return (
    <StaffErrorBoundary>
      <Membership>{children}</Membership>
    </StaffErrorBoundary>
  );
}
function Membership({ children }: { children: ReactNode }) {
  const me = useQuery(api.staff.me);
  if (!me)
    return <div className="container loading">Checking staff access…</div>;
  return (
    <div className="container page-body">
      <div className="page-heading admin-top">
        <div>
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>Staff portal
          </div>
          <h1>Service requests</h1>
          <p className="muted">Hartford 311 · Demonstration workspace</p>
        </div>
        <a href="/cdn-cgi/access/logout">Sign out</a>
      </div>
      <nav className="admin-nav" aria-label="Staff navigation">
        <Link href="/admin">Report queue</Link>
        {me.role === "admin" && <Link href="/admin/team">Staff access</Link>}
        <span className="muted">Signed in as {me.name}</span>
      </nav>
      {children}
    </div>
  );
}
