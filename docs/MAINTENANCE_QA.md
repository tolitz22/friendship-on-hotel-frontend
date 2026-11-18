# Maintenance UI & staff QA

The maintenance workspace is task-first: four hotel-wide status totals, a filtered work-order queue, priority badges, room-impact notices and a role-aware work-order editor.

## Automated read-only staging acceptance
Run `npm run test:e2e:staging -- --grep maintenance` against a dedicated HTTPS staging frontend with `PMS_STAGING_READ_ONLY=1`. Set `PMS_STAGING_URL`, `PMS_STAGING_EMAIL` and `PMS_STAGING_PASSWORD`. Optional separate role coverage requires `PMS_STAGING_ADMIN_EMAIL`, `PMS_STAGING_ADMIN_PASSWORD`, `PMS_STAGING_MAINTENANCE_EMAIL`, `PMS_STAGING_MAINTENANCE_PASSWORD`. Do not commit credentials or run live customer mutations.

## Manual acceptance checklist
- **Stable status totals:** Open, In progress, Resolved, Closed are hotel-wide and remain consistent when the queue status, priority or text filter changes. Counts update after a successful work-order save.
- **Queue scope:** Status and priority filters search all saved work orders. Text and My orders apply only to the loaded page. Empty-state copy accurately communicates this scope.
- **Urgency:** Urgent open work is visually distinguished. Priority badges must be readable in both themes and at 390px mobile width.
- **Permissions:** Only an administrator can create or reassign a work order, change its priority or room-impact flag. A technician can update only orders assigned to their account. Other orders remain read-only.
- **Progress:** Validate Open -> In progress -> Resolved -> Closed, as permitted by existing backend transitions. Do not silently reopen closed work orders.
- **Room-impact safety:** Checking 'Room may be affected' is a note only. It must never auto-block bookings, certify room readiness, or change physical room availability. Use the room's dedicated inventory/maintenance restrictions for blocking.
- **Concurrency:** A stale work-order revision must be rejected by the backend with a clear reload instruction, without silently overwriting a colleague's changes.
- **History:** Existing work-order history remains available inside the editor. Closing the editor must not save any changes.
- **Mobile:** No document horizontal scrolling for summary, queue, filters, work cards or task editor.

Railway build success does not prove browser interactions. Report browser-test execution separately.
