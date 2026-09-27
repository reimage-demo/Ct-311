# Staff walkthrough

1. **Sign in.** Open `/admin` using your invited account and complete MFA. If access is denied, ask the administrator to check your active membership. Never share an account.
2. **Find a report.** The queue starts with the newest submissions. Search a report number, address, name, or contact detail, or choose one filter: status, service, or assignee. Pages load 25 records at a time.
3. **Review.** Open the report to read the description, original language, location, contact preference, and photos. All locations need staff verification; geocoding does not establish jurisdiction. Mark the location reviewed after checking it.
4. **Assign and update.** Move a received report to Under review, select an assignee, then use Assigned or In progress. Explain each update. The explanation remains private; residents see only the status and date. Changes become visible in public lookup after the resident checks again.
5. **Resolve.** Record the resolution in the reason field, choose Resolved, then Closed when appropriate. Closed and Resolved reports may return to Under review with an explanation. Use Needs information when follow-up is needed. This demo does not send automated messages; staff must not assume the person was notified.
6. **Notes.** Add supporting notes without changing status. Notes and activity events are append-only through the app. No public endpoint exposes them.
7. **Conflicting edits.** If another staff member updates the report first, load the latest values before saving again. Your unsaved explanation remains visible for review.
8. **Membership.** Administrators invite staff in Clerk, then add the Clerk user ID in `/admin/team`. Administrators can disable a member or change their role. You cannot disable or demote your own administrator membership. Existing downloaded/viewed information cannot be remotely erased, but subsequent backend/file requests check membership again.

All records and staff actions belong to this isolated demonstration. Do not treat them as official municipal work orders. Public lookup requires the full report number, and there is no public recovery by name or contact details.
