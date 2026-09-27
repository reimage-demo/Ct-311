import Link from "next/link";
export function StaffSetup() {
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
                    After setup, incoming reports appear here with their photos,
                    contact details, and progress history.
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="subtle-note">
        Access is invitation-only. Contact your demonstration administrator for
        an invitation.
      </p>
    </section>
  );
}
