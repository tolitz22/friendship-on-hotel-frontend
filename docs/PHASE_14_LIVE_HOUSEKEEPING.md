# Phase 14 — Live Housekeeping Tasks

## Delivered

API-mode Housekeeping now displays actual selected-hotel cleaning tasks stored in Laravel. The original React mock Housekeeping board is preserved and still used in `VITE_DATA_SOURCE=mock`.

Authorized hotel staff can read task lists, details and recorded event history. Active hotel administrators with write-capable Sanctum tokens can create, assign and update tasks. Task status choices are limited to `todo → in_progress → done`, with a direct `todo → done` option. Completed tasks cannot be reopened in this milestone. Every create or material update records an event in the same database transaction. Updates use `expectedRevision`, returning HTTP 409 when a newer revision exists.

Supported task types: `checkout_clean`, `stayover`, `inspection`. Optional `assignedTo` is currently a **text field**, not a linked hotel staff identity. Optional `dueAt` is entered as a hotel-local `YYYY-MM-DD HH:MM:SS` value; consistent timezone conversion and scheduling notifications remain future work. Each new task starts as `todo` with revision 1.

## Backend API

```http
GET   /api/v1/hotels/{hotel}/housekeeping-tasks?page=1&per_page=50
GET   /api/v1/hotels/{hotel}/housekeeping-tasks/{task}
GET   /api/v1/hotels/{hotel}/housekeeping-tasks/{task}/history
POST  /api/v1/hotels/{hotel}/housekeeping-tasks
PATCH /api/v1/hotels/{hotel}/housekeeping-tasks/{task}
```

GET operations require active hotel membership and `hotel:read` token ability. POST/PATCH additionally require active administrator membership and `hotel:write`. Every room and task is looked up within the selected hotel; cross-tenant record IDs cannot be used.

Example create:

```json
{"roomId":"10","type":"checkout_clean","assignedTo":"Cleaner A","dueAt":"2026-11-20 14:00:00","note":"Cleaning requested"}
```

Example update:

```json
{"expectedRevision":1,"status":"in_progress","assignedTo":"Cleaner A","note":"Started cleaning"}
```

`housekeeping_tasks` stores the task and its revision; `housekeeping_task_events` stores actor ID, before/after snapshots, optional note and event timestamp. The new migration uses Laravel foreign keys, JSON, hotel-scoped room FK and index definitions compatible with MySQL 8.4/InnoDB and PostgreSQL 16+. It depends on the rooms composite unique key introduced in the previous maintenance migration.

## Critical boundary

**Task completion is NOT room readiness.** No change is made to room occupancy, cleaning status in the room catalogue, booking eligibility, reservations, inventory holds, housekeeping-derived readiness or operational Dashboard occupancy. The `determinesRoomReadiness:false` response flag makes this explicit.

Booking policy approval is still required before connecting task completion to front-desk turnover or booking availability. Other operational screens such as Front Desk, Reservations, Billing and Reports remain mock previews.

## Frontend

In API mode, Housekeeping displays a paginated task board, status and assigned staff, with admin create/edit controls and per-task recorded history. The UI invalidates hotel-specific task queries after writes and clears dialog state when changing selected property. The room selector currently displays the first 100 rooms and warns when the hotel has more.

No failed live request is silently replaced by fixture data. The mock Housekeeping page has not been deleted or redesigned.

## Verification

**Backend:**
```powershell
git pull origin main
php artisan migrate
php artisan test
php artisan route:list --path=api
php artisan serve
```

**Frontend:**
```powershell
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

Set `VITE_DATA_SOURCE=api` and `VITE_API_URL=http://localhost:8000/api/v1` in frontend `.env`. In Housekeeping, create a task, move it into progress, mark it done, and verify it persists and its history is recorded.

Added backend `tests/Feature/HousekeepingTasksTest.php` for tenant isolation, role checks, status transitions, 409 conflicts, auditing and inventory separation. Frontend `src/api/liveHousekeeping.test.ts` checks endpoints, credentials, payloads, history and conflicts.

The implementation has been published to GitHub; it still needs local/CI build and runtime verification.
