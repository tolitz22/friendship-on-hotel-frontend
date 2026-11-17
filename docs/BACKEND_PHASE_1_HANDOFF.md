# Backend Phase 1 handoff — preserve frontend milestone

**Frontend is paused after the Hotel Settings & Configuration milestone.** This is not a request to rebuild or replace existing UI.

## Frontend status
- React + Vite + TypeScript, TanStack Query/Router, Tailwind CSS, both light/dark modes
- `VITE_DATA_SOURCE=mock` is the current working development setting
- Completed mock screens: Dashboard, Reservations (calendar/list/wizard), Room Inventory (grid/timeline), Front Desk, Guests, Billing, Housekeeping, Maintenance, Reports, Hotel Settings
- Typed mock and future HTTP adapters live in `src/api`
- The uploaded hotel logo is not yet in GitHub; sidebar currently uses a text brand fallback

## Backend Phase 1
Independent repository: https://github.com/tolitz22/friendship-on-hotel-backend

It now contains a Laravel 12 bootstrap, Sanctum bearer-token API auth, hotel user memberships, property/room-type/room migrations, initial authorization checks, property-scoped reads, restricted property/room catalog writes, PHP test files, and CI setup.

## Important API integration gap
The backend deliberately exposes `GET /api/v1/hotels/{hotel}/rooms`, `/room-types`, and `/hotels/{hotel}`, while the frontend mock-to-API bridge currently expects `/api/v1/rooms` and `/api/v1/settings/overview`.

Backend room data does NOT yet have the physical occupancy/housekeeping/maintenance status fields expected by the existing UI. Do not fabricate them or silently return fixture data when API requests fail.

The backend uses Bearer tokens for Phase 1 testing; a production browser SPA should use a properly designed Sanctum cookie/session or equivalent secure flow, rather than storing long-lived access tokens in browser localStorage.

## When we resume frontend integration
1. Verify backend dependencies, migrations, and CI.
2. Establish authenticated selected-hotel context.
3. Align hotel settings and room-catalog DTOs and API paths.
4. Add explicit loading/error/permission states and integration tests.
5. Preserve working mock mode until each API screen is implemented.
6. Only later integrate reservations/availability/payment after requirements approval and concurrency testing.

Never claim a live reservation system exists based on the frontend's simulated UI.


## Backend Phase 2 continuity (2026-11-17)

Backend repository has added *structural reservation records* with property-scoped room type and optional matching physical-room assignment, half-open date rules, a pure known-room overlap detector, and read-only `GET /api/v1/hotels/{hotel}/reservation-records`.

This is **not** a live booking API. It does not write reservations, hold availability, assign rooms transactionally, enforce a booking lifecycle, or calculate prices. The frontend remains exactly where it was after the Hotel Settings milestone; its `/reservations` and `/reservations/calendar` API contracts do not match the backend's structural reservation-record endpoint.

See backend `docs/RESERVATION_DOMAIN.md` and `docs/PHASE_2.md` for scope and inventory policy decisions. Preserve mock mode until backend authentication and DTO reconciliation are explicitly implemented.

## Database compatibility decision (2026-11-17)

The backend now targets both **MySQL 8.4 LTS (InnoDB)** and **PostgreSQL 16+**, selectable through the backend `DB_CONNECTION` environment setting. See backend `docs/DATABASE_COMPATIBILITY.md`. The React frontend is database-independent and stays in mock mode until contracts and authentication are reconciled. No frontend data flow or UI milestone has changed.

## Backend Phase 3 read-only conflict reporting

The backend now exposes `GET /api/v1/hotels/{hotel}/rooms/{room}/reservation-overlaps?from=YYYY-MM-DD&to=YYYY-MM-DD` for scoped structural overlap diagnostics. This is NOT a room availability endpoint, does not handle unassigned bookings or holds, and creates no reservations. The frontend is unchanged from the Hotel Settings & Configuration milestone, and `VITE_DATA_SOURCE=mock` remains the development mode. See backend `docs/PHASE_3.md`.

## Backend Phase 4 — Guest Management

Backend now has a hotel-scoped guest directory and validated CRUD subset (list/view plus admin-only create/update; no delete). The wire DTO matches the existing typed frontend `Guest`, but the backend route is `/api/v1/hotels/{hotel}/guests`, not the frontend's current `/api/v1/guests`. **Frontend UI, mock data, and last completed Hotel Settings milestone remain unchanged.** Do not switch to live API mode before adding selected-hotel authentication and route mapping. See backend `docs/PHASE_4_GUESTS.md`.

## Frontend Phase 5 integration implemented

The frontend now has an API-mode sign-in gate, selected-hotel context, and a **live Guests page**, including authorized administrator create/edit. Guest bearer tokens are in-memory only (refresh signs out). All other PMS modules remain explicitly labeled mock previews. The final browser auth strategy, real reservations, live rates, occupancy, and operational status integrations are still pending. See frontend `docs/PHASE_5_LARAVEL_INTEGRATION.md` and backend `docs/PHASE_5_FRONTEND_INTEGRATION.md`.

## Phase 6 live property catalogue

API mode now uses Laravel for Overview (registered physical room count, type/floor counts and selected property), Room Inventory (catalogue list + validated room/floor filtering), and Settings (read-only saved contact details, types and floors). **No occupancy, vacant/dirty room, rate, booking, or operational summary values are presented as live.** Existing mock components are still available in mock mode. Backend provides `/api/v1/hotels/{hotel}/catalog-summary`. See `docs/PHASE_6_LIVE_CATALOG.md`.

## Phase 7 administration continuity

Live API mode now supports admin-only room type and physical room **creation**, from Settings and Room Inventory, using existing Laravel POST endpoints. The shared room catalogue summary and lists refresh after successful creation. No edit, delete, inventory availability, reservation create, occupancy or operational status API has been added; mock components are preserved. See `docs/PHASE_7_CATALOG_ADMIN.md`.

## Phase 8 — Admin catalogue edits

In API mode, authenticated admins can edit room numbers, floors and safe type assignments from Room Inventory; room type names and safe capacities from Settings. Server writes are audited per record and refresh the shared catalogue. Referenced inventory assignments and capacities are blocked as described in `docs/PHASE_8_CATALOG_EDITS.md`. No booking engine or occupancy API is enabled. The previous mock UI remains preserved.

## Phase 9 read-only reservation demand

Backend adds `/api/v1/hotels/{hotel}/reservation-demand`; frontend API mode adds a Demand diagnostic sidebar view without replacing the preview reservation calendar/wizard. The report is structural only, ignores lifecycle filtering and does not determine availability. No real booking create endpoint exists. See `docs/PHASE_9_RESERVATION_DEMAND.md`.

## Phase 10 — Booking policy draft planning

Frontend API mode has a new Booking policies screen backed by versioned, hotel-scoped Laravel policy drafts. Administrators can edit decisions and review revision history; no draft ever activates bookings. Reservation calendar/wizard remains mock; Demand diagnostic remains non-availability. See `docs/PHASE_10_POLICY_DRAFTS.md`.

## Phase 11 — Advisory policy readiness

API mode Booking policies now displays the persisted policy draft's read-only readiness analysis, including unresolved implementation rules. This is not activation and no changes are made to the preview booking wizard. See `docs/PHASE_11_POLICY_READINESS.md`.

## Phase 12 — Structural stay simulation

Backend now exposes a GET-only property-scoped proposed-stay overlap report and the frontend exposes it through Stay simulator in API mode. No reservation create or occupancy functionality has been added; prior mock Reservations are preserved. See `docs/PHASE_12_RESERVATION_SIMULATION.md`.
