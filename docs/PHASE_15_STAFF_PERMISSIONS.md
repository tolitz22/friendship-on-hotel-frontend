# Phase 15 — Staff memberships, linked assignments and least-privilege task updates

## Scope

This milestone adds a **real hotel-scoped staff membership directory** and separates **operational task status updates** from full administrator privileges.

Existing Laravel users can be attached to a hotel, with one active role per hotel: `admin`, `front_desk`, `housekeeping`, or `maintenance`. A user's roles may differ between hotels. Active hotel membership is checked on **every API request**; disabling it immediately removes access to that hotel's resources even for an already-issued bearer token.

The frontend includes an administrator-only **Hotel staff** page in API mode, and linked staff account selectors for both the Maintenance and Housekeeping task forms.

## Permission matrix

| Operation | Admin | Housekeeping staff | Maintenance staff | Front desk |
| --- | --- | --- | --- | --- |
| Read hotel task boards and task history | Yes | Yes | Yes | Yes |
| Add work order or cleaning task | Yes | No | No | No |
| Link/reassign tasks or change operational assignment fields | Yes | No | No | No |
| Update status and handover note on own linked housekeeping task | Yes | Only when assigned | No | No |
| Update status and handover note on own linked maintenance ticket | Yes | No | Only when assigned | No |
| Manage staff membership, roles, active state and staff audit | Yes | No | No | No |
| Configure hotel catalogue, guest admin data, policy drafts | Yes | No | No | No |

**Important:** The `assigned_to` free-text field from earlier phases does **not** grant any permissions. Only `assigned_user_id` linked to a real active user with the correct **active membership role in the selected hotel** can receive operational permissions. Admins can assign an active user with the relevant role or an administrator account. A text name alone is never trusted.

The assigned member may submit **only** `expectedRevision`, a permitted lifecycle `status`, and optional `note`. The backend rejects unauthorized attempts to change priority, due date, assignment, room-impact flag or other administrative fields, even if crafted manually. All original transition restrictions and HTTP 409 revision conflict behavior remain.

Staff can read the hotel's task board, but can modify **only their own linked tasks**. Task creation remains admin-only.

## New staff APIs

```http
GET   /api/v1/hotels/{hotel}/staff
GET   /api/v1/hotels/{hotel}/staff/history
POST  /api/v1/hotels/{hotel}/staff
PATCH /api/v1/hotels/{hotel}/staff/{userId}
```

All staff-directory operations require existing `auth:sanctum`, active-user, active selected-hotel membership and `hotel.admin` middleware. No global user-directory search or password data is exposed.

Attach an **existing** account:

```json
{"email":"cleaner@example.com","role":"housekeeping"}
```

Update a membership:

```json
{"role":"maintenance","isActive":true}
```

Only roles above are accepted. An administrator cannot deactivate or demote their own selected-hotel administrator role; at least one active administrator must remain. Duplicate memberships return 422. Removing a user's membership access or changing the role invalidates their authorization for future related API requests. A promoted administrator needs to **sign out and sign in again** for a fresh write-capable Sanctum token.

Each actual membership attachment/change is audited transactionally in `hotel_staff_events`, recording hotel, actor, target user, before and after role/activation state and timestamp. No-op updates produce no event.

## Provisioning a staff login

For local/dev setup, the Laravel backend provides a secure-prompt CLI command that creates a standalone user **without any hotel membership**:

```powershell
php artisan hotel:staff-user cleaner@example.com "Cleaner A"
```

The command prompts for a password twice **without displaying or accepting it as a CLI argument**. It enforces a minimum 12-character password and rejects an existing email. No hotel privileges are granted by this step.

Then sign in as an **existing hotel admin** in React API mode, choose **Hotel staff**, and attach the existing login by email using the desired role. The new member signs in to see their hotel and assigned tasks.

**Production onboarding limitation:** The CLI account provisioner is intended for controlled development/administrative setup. This phase does not implement self-service password changes, invitation links, email verification, password reset or short-lived one-time credentials. Do not deploy the provisional password-sharing workflow to real staff without implementing an approved secure onboarding/reset flow.

## Task assignment data and migration

New migration: `database/migrations/2026_11_17_000007_add_linked_staff_assignments.php`.

- Adds nullable `assigned_user_id` (foreign key to users) to `housekeeping_tasks` and `maintenance_work_orders`, plus hotel/assignee/status indexes.
- Adds `hotel_staff_events`, with hotel, actor and target user FKs and JSON before/after snapshots.
- Existing historical tasks remain valid with `assigned_user_id = null`. Their free-text assignee names remain visible but **do not authorize** operational updates.
- The migration depends on previous housekeeping and maintenance tables and is compatible with MySQL 8.4/InnoDB and PostgreSQL 16+ using standard Laravel schema operations.

Admin task forms now include an **active linked staff account** selector. The backend validates that an assignee is an active member of **the same hotel** with the appropriate role. Inactive, foreign-property or wrong-role user IDs return 422. Existing task events retain actor IDs and before/after snapshots; linked assignment changes are audited through those events.

## Existing auth and booking boundaries

The current browser uses development-only, in-memory Sanctum bearer tokens (a reload signs the user out). **This is not production-ready browser session architecture**. A future milestone should implement a secure stateful SPA session, token lifecycle, and account invitation/password management.

No reservation writes, occupancy changes, booking availability, maintenance blocks or room readiness state changes are enabled by Phase 15.

## Verification

Backend:

```powershell
git pull origin main
php artisan migrate
php artisan test
php artisan route:list --path=api
php artisan hotel:staff-user cleaner@example.com "Cleaner A"
php artisan serve
```

Frontend:

```powershell
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

With `VITE_DATA_SOURCE=api` and `VITE_API_URL=http://localhost:8000/api/v1`, sign in as admin, go to Hotel staff, attach the existing login as `housekeeping` or `maintenance`, then assign a real task using the linked account selector. Sign out and sign in as that staff member; verify they can update only their own assigned task status and note.

Added `tests/Feature/HotelStaffPermissionsTest.php` and `src/api/liveStaff.test.ts` covering role isolation, tenant boundaries, audit, 403/404/409 behavior, deactivation and linked-assignee validation. Run these along with the existing Phase 13/14 suites on MySQL and PostgreSQL before production use.

Source changes are published; successful local migrations, CI and browser end-to-end functionality have **not** been independently confirmed.
