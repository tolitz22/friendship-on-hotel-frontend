# Phase 49 — Role-Based Workspaces

## Delivered

The logged-in user's **active membership role for the selected hotel** determines the landing screen, side navigation, and quick actions. Switching hotels recomputes the workspace from the new selected hotel's membership, not from other hotels' privileges.

| Laravel role | Home experience | Main navigation |
|---|---|---|
| `admin` | Existing full hotel management dashboard | All operational tools, reports, exceptions and audit, staff and settings |
| `front_desk` | Reception dashboard with live arrivals and due departures | Front desk, reservations, room rack, guest directory, folios, room status |
| `housekeeping` | Task-focused home with page-scoped assigned to-do count and hotel to-do queue count | Housekeeping tasks, room readiness, maintenance reference |
| `maintenance` | Work-order and room status landing | Maintenance, room readiness, housekeeping reference |

The front desk **New reservation** button and booking/assignment/check-in/check-out actions are now shown to administrators only. Non-admin receptionists can open reservations for viewing and manager follow-up, rather than being offered actions that fail Laravel authorization.

Housekeeping staff can still update their own assigned tasks under Laravel's existing revision and assignment guard. Task completion **is not** a room-readiness certificate.

The sidebar retains Account Security for all staff. Admin-only Exceptions & Audit remains hidden from non-admin navigation and the endpoint is guarded by `hotel.admin`.

## Critical permissions note

These are **presentation preferences, not server-side authorization rules**. Laravel `hotel.member` currently allows broad hotel-scoped **read** access to several endpoints, while admin-only reservations and financial writes require `hotel.admin`; task updates enforce assignee roles. Hiding a page does not revoke backend read access. A future server-side least-privilege milestone should introduce explicit per-role read policies where appropriate.

## Validation plan

1. Use a synthetic hotel administrator, receptionist, housekeeper, and maintenance account in isolated staging.
2. Visit `/` for each selected role. Confirm the correct home and visible navigation.
3. As receptionist, open Front Desk and confirm the **New reservation** and admin-only assignment/check-in/checkout shortcuts are absent.
4. As housekeeping, verify only tasks explicitly assigned to the signed-in user are included in the **My assigned to-do tasks** page-scoped count.
5. As a multi-hotel user, switch between different-role hotels; dashboard links, task queries and navigation must change without leaking the previous hotel's task counts.
6. Confirm the manager can access Exceptions & Audit while ordinary staff are rejected by its Laravel endpoint.
7. Execute `npm ci`, `npm run build`, `npm test` and conduct browser acceptance on an isolated staging property.

No npm dependency additions or `package-lock.json` changes.
