# Phase 13 — Live maintenance work orders

## Scope

The React/Vite PMS now uses a real Laravel-backed **Maintenance** screen in `VITE_DATA_SOURCE=api`. The previous mock Maintenance interface remains unchanged and available when `VITE_DATA_SOURCE=mock`.

Supported features:
- Active hotel staff members with `hotel:read` can list and inspect tickets and see their history.
- Active hotel administrators with `hotel:write` can create room-linked work orders and update the work-order priority, technician text field, informational room-impact flag and lifecycle status.
- Every creation and meaningful update is recorded in `maintenance_work_order_events`, including editor ID, timestamp, before/after status snapshot and optional handover note.
- Revision checks return HTTP **409** if an older version is edited after another admin's update.
- List pagination is capped at 100 per page; the React board shows 50. Its summary counters reflect the **current page**, not full-hotel totals.

Maintenance statuses in this foundational workflow: `open → in_progress → resolved → closed`; admins may also resolve directly from `open`. Closed tickets cannot reopen in this milestone. The initial status is `open`; the initial revision is 1. No delete endpoint exists.

## Backend endpoints

```http
GET   /api/v1/hotels/{hotel}/maintenance-work-orders?page=1&per_page=50
GET   /api/v1/hotels/{hotel}/maintenance-work-orders/{order}
GET   /api/v1/hotels/{hotel}/maintenance-work-orders/{order}/history
POST  /api/v1/hotels/{hotel}/maintenance-work-orders
PATCH /api/v1/hotels/{hotel}/maintenance-work-orders/{order}
```

All routes are protected by `auth:sanctum`, `active.user` and `hotel.member`. Only POST/PATCH additionally use `hotel.admin`. A referenced physical room must belong to the selected hotel. Foreign property IDs never grant access.

Create example:

```json
{
 "roomId":"10",
 "title":"Air conditioning repair",
 "description":"Compressor noise in the room.",
 "priority":"high",
 "assignedTo":"Engineer A",
 "affectsRoom":true,
 "note":"Reported at front desk."
}
```

Update example:

```json
{
 "expectedRevision":1,
 "status":"in_progress",
 "assignedTo":"Engineer A",
 "note":"Inspection started."
}
```

The backend validates enum fields, required text, maximum lengths, room ownership and lifecycle transitions. Work order updates and their audit events are written in the same database transaction.

## Critical inventory boundary

**`affectsRoom` is an informational flag only.** It is not an inventory block, housekeeping state, physical-room maintenance status, availability calculation, or room-night hold. Resolving/closing a work order does **not** release any room or change any existing reservation.

Maintenance-block semantics (automatic/manual, effective stay nights, operator overrides, priority, release and audit) still require hotel approval before integration with booking inventory.

## New migrations

- `database/migrations/2026_11_17_000005_create_maintenance_work_orders_tables.php`
- Tables `maintenance_work_orders` and `maintenance_work_order_events`.

Both tables use standard Laravel schema features, indexed hotel IDs, property-scoped room FK and JSON audit payloads for MySQL 8.4/InnoDB and PostgreSQL 16+; SQLite runs feature tests.

**Run migrations before testing the live UI.**

## Frontend

In API mode, choose **Maintenance** in the existing sidebar. Administrators can add a ticket for a selected registered room, view a ticket's status and edit allowed fields. Both admins and other hotel members can inspect recorded history.

The create form's room dropdown includes the first 100 catalogued physical rooms. Hotels with more than 100 rooms will need a paginated room-picker improvement; the frontend does not represent the first page as the full hotel.

## Run and verify

Backend:

```powershell
git pull origin main
php artisan migrate
php artisan test
php artisan route:list --path=api
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

Use `VITE_DATA_SOURCE=api` and `VITE_API_URL=http://localhost:8000/api/v1`. Sign in as an existing hotel administrator, create a ticket, mark it in progress, view audit history, and resolve it. Confirm the ticket persists after returning to the screen.

Backend `tests/Feature/MaintenanceWorkOrdersTest.php` exercises tenant isolation, roles, transitions, stale edits, audit history and reservation isolation. Frontend `src/api/liveMaintenance.test.ts` covers scoped reads/writes and errors.

These tests and source files have been published, but passing CI, local migrations and real browser workflows still need verification.

## What remains mock or unapproved

Reservation creation, live occupancy, housekeeping, billing, front desk actions and operational reports remain mock previews or unimplemented. The old Maintenance mock experience is preserved in mock mode. This milestone does not enable booking or inventory blocking.

Next: dedicated maintenance scheduling and approved room-night inventory blocks, or live Housekeeping tasks, depending on confirmed hotel operational requirements.
