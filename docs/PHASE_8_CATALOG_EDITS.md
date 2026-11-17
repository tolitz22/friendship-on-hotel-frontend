# Phase 8 — Audited room catalogue editing

## What changed

With `VITE_DATA_SOURCE=api`, administrators for the selected hotel can edit existing catalogue records, while hotel members without administrator privileges remain read-only.

- **Room Inventory → Edit room:** change room number, floor (including clearing it), or assigned room type when safe.
- **Settings → Room types → Edit:** change a room type's name or its maximum occupancy when safe.
- **View edit history** within the edit dialog to inspect the Laravel-created actor ID, previous values, new values, and timestamp.
- The existing Phase 7 room/type creation forms and Phase 6 live catalogue views remain intact.

Each successful meaningful edit writes a `catalog_audit_logs` record in the same database transaction as the edited row. Repeating a no-op update does not create an audit event.

The UI checks the `/auth/me` selected-hotel `admin` membership only to display controls; Laravel continues enforcing active hotel membership and write-capable token abilities. Other tenants' record IDs return 404 rather than disclosing their details.

## New endpoints

```http
PATCH /api/v1/hotels/{hotel}/rooms/{room}
PATCH /api/v1/hotels/{hotel}/room-types/{type}
GET /api/v1/hotels/{hotel}/catalog-audit?subjectType=room&subjectId={room}
GET /api/v1/hotels/{hotel}/catalog-audit?subjectType=room_type&subjectId={type}
```

All three endpoint forms require **an active hotel administrator with both `hotel:read` and `hotel:write` abilities**, including the audit-history route. The audit read is capped at 50 entries per page and defaults to 20.

## Reservation-linked safeguards

The backend deliberately restricts structural changes while the reservation business policies remain undecided:

- **Room-type occupancy capacity:** cannot change when that room type has *any* associated `reservation_records` row, regardless of lifecycle state.
- **Physical room type reassignment:** cannot change when that physical room or its current room type has *any* associated reservation record, including unassigned room-type records.
- **Room number/floor:** can be edited; prior values and editor ID are kept in the audit trail.
- **Room type name:** can be renamed, even if referenced, with audit history.
- **No deletion, inventory assignment, booking writes, holds or availability decisions** have been enabled.

These checks deliberately err on the side of restricting changes. They are not a complete concurrency-control design for future bookings. Concurrent reservation writes must use compatible transactional locks once the booking engine is designed.

Validation errors from the backend (422, including duplicate room numbers and foreign-hotel room types) are surfaced in the dialog. A successful edit invalidates `live-catalog`, `live-room-types`, `live-rooms`, and `catalog-audit` caches so Overview, Settings and Room Inventory reflect saved data.

## Database support

A new migration creates the database-neutral `catalog_audit_logs` table with a hotel foreign key, actor foreign key, subject type/ID, JSON before/after values, and timestamp/index. It targets **MySQL 8.4 / InnoDB and PostgreSQL 16+**, with SQLite available for fast tests. No vendor-specific trigger or range column is introduced.

Backend tests: `tests/Feature/CatalogEditTest.php` validates tenant isolation, admin permissions, audit fidelity/no-op behavior, duplicate validation and reservation safeguards.

Frontend tests: `src/api/liveCatalog.test.ts` verifies property-scoped PATCH/audit requests and server error handling.

## Run locally

```powershell
# backend
git pull origin main
php artisan migrate
php artisan test
php artisan serve

# frontend
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

Use the existing frontend `.env`: `VITE_DATA_SOURCE=api`, `VITE_API_URL=http://localhost:8000/api/v1`.

## Limitations / next steps

This edit-history module audits **edits**, not the initial Phase 7 creation endpoints. Real production administrative change management should broaden auditing to creation, add controlled deletion/deactivation, stale-write detection (optimistic concurrency), reason capture, and privacy-aware retention rules. Approval is needed before enabling reservation/availability mutations.

The front desk, reservations, billing, housekeeping, maintenance and reports remain mock previews. The original mock screens are preserved with `VITE_DATA_SOURCE=mock`.
