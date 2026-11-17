# Phase 7 — Administrative room catalogue creation

Status: source published in both repositories; confirm tests/build and a real browser creation against a non-production Laravel database.

## Scope

In `VITE_DATA_SOURCE=api`, authorized hotel administrators can now:

- Open **Settings → Room type**, enter a name and maximum occupancy, and create the room type in Laravel.
- Open **Settings → Add room** or **Room Inventory → Add room**, choose one registered room type, enter a physical room number and optional floor, and create the room in Laravel.
- Receive server validation errors (including duplicate room type or room number) without hiding the error behind example fixture data.
- See updated room counts and catalogues across Overview, Settings and Room Inventory after success.

The UI shows these controls only when the authenticated `/auth/me` hotel membership role is `admin`. **The server remains authoritative**: Laravel's existing `hotel.member` and `hotel.admin` middleware enforce active membership, active users, and `hotel:read`/`hotel:write` token abilities.

No new backend migration or schema changes are required. The existing MySQL/PostgreSQL-compatible catalogue tables and API endpoints handle writes.

## APIs

| Action | Backend route | Data |
| --- | --- | --- |
| Add room type | `POST /api/v1/hotels/{hotel}/room-types` | `{name:string,maxOccupancy:integer}` |
| Add physical room | `POST /api/v1/hotels/{hotel}/rooms` | `{roomTypeId:string,number:string,floor:integer|null}` |

Backend validation: room type name at most 120 characters and unique per hotel, occupancy 1–65,535, room number at most 32 characters and unique per hotel, floor nullable or 0–65,535. The requested room type must belong to the **same hotel**. Missing/invalid input returns 422 with field errors; non-admin access returns 403. Database uniqueness also protects concurrent duplicate creation.

Room creation **does not** create a reservation, hold, occupancy status or sellable availability. Editing, deleting, bulk imports and room reassignments remain out of scope until impact and audit policies are approved.

## Query cache refresh

Successful writes invalidate the TanStack Query prefixes `live-catalog`, `live-rooms`, and `live-room-types`. This refreshes the Overview counts, Settings room-type/floor summary, physical-room listings and type pickers without manual reload.

Changing the selected hotel resets the open create dialog. The backend request path is derived from the currently selected hotel, and the backend enforces the tenant association.

## Tests

Frontend: `src/api/liveCatalog.test.ts` covers authenticated POST paths and bodies, cross-hotel scoping via selection, 422 error propagation, and missing hotel context.

Backend: `tests/Feature/CatalogAdministrationTest.php` covers valid creation, duplicate room type/room number, invalid floor/capacity, foreign-hotel room type, unauthenticated requests, and non-admin or no-write-token access. The existing multi-engine CI runs the suite on SQLite, MySQL 8.4 and PostgreSQL 16 when it runs successfully.

Run locally:

```powershell
# Laravel backend
git pull origin main
php artisan test
php artisan serve

# React/Vite frontend (separate terminal/repo)
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

Keep `VITE_DATA_SOURCE=api` and `VITE_API_URL=http://localhost:8000/api/v1`.

Sign in with an existing hotel admin, visit Settings, add a room type (e.g., Standard), then add a physical room (e.g., 201). Verify the Overview registered-room totals and Room Inventory reflect it.

## Continuity

Mock mode retains all previous demo pages. API mode continues to show live property/room catalogue and guest data. Reservations, booking availability, Front Desk, Billing, Housekeeping, Maintenance, Reports remain explicitly mock previews.

The next milestone should cover admin-only **editing existing room catalogue records** with server-side audit trails and conflict checks, or production browser sessions; no booking writes before inventory business rules are approved.
