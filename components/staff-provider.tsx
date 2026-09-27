"use client";
import { ClerkProvider, SignIn, UserButton, useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState, Component, type ReactNode } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
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
        <div className="notice error" role="alert">
          <h2>Access interrupted</h2>
          <p>
            Your session or staff access may have changed. Sign in again or
            contact your administrator.
          </p>
          <button
            className="button secondary"
            onClick={() => location.reload()}
          >
            Reload portal
          </button>
        </div>
      );
    return this.props.children;
  }
}
export function StaffProvider({
  children,
  serverConfigured,
}: {
  children: ReactNode;
  serverConfigured: boolean;
}) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL,
    key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!url || !key || !serverConfigured)
    return (
      <section className="container page-body">
        <div className="page-heading">
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>Staff portal
          </div>
          <h1>Staff portal</h1>
          <p className="lead">
            Review reports. Assign responsibility. Keep residents informed.
          </p>
        </div>
        <div className="notice warning">
          <h2>Secure staff access is not connected yet</h2>
          <p>
            This preview does not contain live report records. Staff sign-in and
            the report database must be configured before the queue can open.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Report queue structure; no records loaded
            </caption>
            <thead>
              <tr>
                <th>REPORT</th>
                <th>SERVICE</th>
                <th>LOCATION</th>
                <th>STATUS</th>
                <th>ASSIGNED TO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <h2>No connected records</h2>
                    <p>
                      After setup, incoming reports appear here with their
                      photos, contact details, and progress history.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="subtle-note">
          Access is invitation-only. Contact your demonstration administrator
          for an invitation.
        </p>
      </section>
    );
  return (
    <ClerkProvider publishableKey={key}>
      <Connected url={url}>
        <StaffErrorBoundary>
          <Gate>{children}</Gate>
        </StaffErrorBoundary>
      </Connected>
    </ClerkProvider>
  );
}
function Connected({ url, children }: { url: string; children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(url));
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
function Gate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading)
    return <div className="container loading">Checking staff access…</div>;
  if (!isAuthenticated)
    return (
      <div className="container page-body">
        <div className="page-heading">
          <h1>Staff sign in</h1>
          <p>Invited staff only. Multi-factor authentication is required.</p>
        </div>
        <SignIn routing="hash" forceRedirectUrl="/admin" />
      </div>
    );
  return <Membership>{children}</Membership>;
}
function Membership({ children }: { children: ReactNode }) {
  const me = useQuery(api.staff.me);
  if (me === undefined)
    return <div className="container loading">Checking staff membership…</div>;
  if (!me)
    return (
      <div className="container page-body">
        <div className="page-heading">
          <h1>Staff access required</h1>
          <p>
            Your account is signed in but has no active staff membership. Ask
            the demonstration administrator to grant access.
          </p>
        </div>
        <UserButton />
      </div>
    );
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
        <UserButton />
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
