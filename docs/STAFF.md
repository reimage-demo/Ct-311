# Staff walkthrough

1. Open the Cloudflare-hosted `/admin/` page. Cloudflare Access verifies your invited identity and MFA. Your signed identity must also have active portal membership. The GitHub Pages admin page remains a setup preview.
2. The queue starts with 25 reports. Filter by status, service or assignee, or search report numbers, addresses and contacts. Results load in bounded pages; active views refresh periodically. Search order is newest insertion first.
3. Select **Review**. Check the issue, address, photos and contact information. Verify manual locations and jurisdiction; the map is only a Hartford-area bounding-box aid.
4. Intake staff can review, add internal notes and change status. Administrators additionally assign responsibility and manage membership. Every progress update requires a reason or resolution.
5. If another person edited the report, load the latest values before saving. The backend will not silently overwrite an earlier version.
6. Use **Needs information** when necessary. Resolved/closed reports may reopen to **Under review**, with an internal reason. Public lookup displays standardized bilingual progress only, never staff reasons or contact details.
7. Notes and activity history are append-only through the application. Photo downloads require current active membership. Already downloaded information cannot be remotely erased.
8. Administrators allow a person in Cloudflare Access, then add their verified Access subject ID through **Staff access**. Subjects are immutable. Disabling membership blocks subsequent API/photo requests even if an Access session remains valid. Conflicting membership edits require refresh.
9. Use **Sign out** to terminate the Access session. Report suspicious access, missing photos or delayed queues to the demo operator. Do not enter real resident information in the demonstration.
