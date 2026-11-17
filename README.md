# Friendship On Hotel PMS — Frontend

React + Vite + TypeScript, TanStack Router, TanStack Query, Tailwind CSS 4. Branded light and dark hotel operations prototype.

## Getting started

Install a Node version supported by Vite 7.

```bash
npm install
cp .env.example .env
npm run dev
```

This starts in **mock mode**, with no Laravel server required. The sample records are fictional and are for UI development only.

## Available mock screens

- Hotel dashboard with room condition metrics and recent reservations
- Reservations calendar with day/week views, status and room-type filters, details drawer, searchable list view, and a mock-only reservation preview wizard
- Room inventory with floor and search filters, plus a 7/14-day physical-room timeline
- Guest profiles with search
- Front desk date-based arrivals/departures/in-house queues and simulated check-in/check-out walkthroughs
- Folio/billing list with exact-money formatting
- Housekeeping mock Kanban board, staff assignment preview, progress stages, inspection notes, and maintenance alerts
- Maintenance management with work-order filtering, technician preview assignment, room impact notes and maintenance history
- Reports & Analytics with mock date filters, charts, CSV export and clearly labeled current-state snapshots
- Hotel Settings mock workspace with property details, floor and room-type preview, operational times and example staff roles

**All booking/check-in/payment/housekeeping write actions are disabled** pending approved business policies and backend endpoints.

## Switching to the Laravel API

Set `VITE_DATA_SOURCE=api` in `.env`. Configure `VITE_API_URL` to match the Laravel API. Live API failures will be surfaced as errors; the app does not silently replace them with mock data.

See [API contract](docs/API_CONTRACT.md). Source of truth for entity types is `src/api/types.ts`; queries in `src/api/queries.ts`; transport adapters in `src/api/httpDataSource.ts` and `src/api/mock/dataSource.ts`. Keep all pages using query hooks, not fixture imports.

## Build

```bash
npm run typecheck
npm run test
npm run build
```

The build must be verified in an environment with project dependencies installed. Backend repo: https://github.com/tolitz22/friendship-on-hotel-backend.

## Logo

The original uploaded Friendship On Hotel logo was provided in the downloadable frontend project bundle but is not yet published into this GitHub repo. Until added as `public/logo.png`, the app uses a compact text brand.

## Reservation calendar milestone

Read [RESERVATION_CALENDAR.md](docs/RESERVATION_CALENDAR.md) for calendar date semantics, room-type grouping, and the proposed `GET /reservations/calendar` contract.

The calendar is a **schedule only**. It does not calculate availability or prevent double bookings. It deliberately includes unassigned reservations and models occupied nights using `[checkIn, checkOut)`.

Unit tests for date/week/checkout calculations run with `npm run test`.

## Room inventory timeline milestone

Room inventory now offers **Timeline** and **Grid** views. The timeline shows assigned sample reservations and dated maintenance blocks, highlights overlapping sample records, and keeps unassigned room-type bookings separate. It is a *read-only physical-room schedule*; no-assignment cells are **not** availability guarantees.

See [Room Timeline API contract](docs/ROOM_TIMELINE.md) for the planned Laravel endpoint and display rules. The source remains selectable using `VITE_DATA_SOURCE=mock|api`.

## Mock reservation preview

Select **Preview new booking** on the Reservations page while `VITE_DATA_SOURCE=mock`. Step through an existing fictional guest, hotel-local stay dates, room type, occupant counts, and an illustrative room-only subtotal. Completing the preview does **not** create, hold, save, or charge a reservation. The wizard is disabled in API mode until Laravel pricing and inventory rules are approved. See [BOOKING_WIZARD.md](docs/BOOKING_WIZARD.md).

## Front Desk preview

Open Front Desk to explore the current operational date, then switch between arrivals, departures and in-house guests. In `VITE_DATA_SOURCE=mock` mode, sample queue rows can open simulated check-in/check-out staff checklists. The completion action only shows a success preview—it **never changes** reservations, occupancy, folios or payments. Use November 17, 2026 for sample arrival/departure records. See [Front Desk contract](docs/FRONT_DESK.md).

## Housekeeping mock milestone

Open Housekeeping to see tasks grouped as To do / In progress / Completed. Filter by floor and team, inspect conditions, and simulate staff assignments or task progress. Use **Reset preview** to discard draft changes. No real reservation, housekeeping status, room readiness, maintenance or billing data changes. See [HOUSEKEEPING.md](docs/HOUSEKEEPING.md).

## Maintenance milestone

Open Maintenance for sample work orders and repair history. Filter by priority and status, review room-impact flags, and try local-only technician or status edits. Use Reset preview to discard these changes. No physical room is blocked or released by these drafts. See [MAINTENANCE.md](docs/MAINTENANCE.md).

## Reports & Analytics milestone

Navigate to Reports to explore check-in-based booking counts, maintenance reports, sample room and housekeeping snapshots, folio totals and a sample CSV export. Do not treat sample booking values or folio payments as recognized revenue. See [REPORTS.md](docs/REPORTS.md).

## Settings milestone

Open Settings for property details, sample room type/floor configuration, operational preferences and sample staff-role labels. In mock mode you can edit property contact fields and operational times, validate the preview and reset to defaults. Nothing is persisted. Room types and roles are read-only. See [SETTINGS.md](docs/SETTINGS.md).

## Phase 5 — Laravel staff authentication and live Guests

With `VITE_DATA_SOURCE=api`, the app now requires staff sign-in through Laravel and a selected hotel membership. The **Guests** page becomes live with hotel-scoped list/search, pagination and administrator create/edit actions; all other PMS pages remain explicitly labeled **MOCK PREVIEW**. No live booking or financial mutation exists. Access tokens are kept in JS memory only and lost on refresh; this developer integration is not the final production browser authentication strategy. See [Phase 5 setup, security and API contracts](docs/PHASE_5_LARAVEL_INTEGRATION.md).

## Phase 6 — Real Property Catalogue

In `VITE_DATA_SOURCE=api`, **Overview**, **Room Inventory**, and **Hotel Settings** now show authenticated, hotel-scoped Laravel data. They display saved property contact fields, registered room totals, room types and floors. Occupancy, maintenance, housekeeping, rates and bookings remain **unavailable**, never fabricated as live. Guests remains live from Phase 5; all other modules are explicitly labeled previews. See [Phase 6 integration](docs/PHASE_6_LIVE_CATALOG.md).

## Phase 7 — Room catalogue administration

In API mode, hotel administrators can create registered room types from Settings, and physical rooms from either Settings or Room Inventory. Laravel validates permissions, duplicate room numbers and room-type membership; the frontend surfaces field errors and refreshes Overview/Settings/Room Inventory counts. Existing mock screens remain available. See [Phase 7](docs/PHASE_7_CATALOG_ADMIN.md). No reservation/availability functionality is implied.

## Phase 8 — Guarded Catalogue Editing and Audit History

Admin users can now edit room numbers/floors/types from Room Inventory and room type names/capacities from Settings, subject to reservation-linked restrictions enforced by Laravel. Successful edits are audited transactionally and the UI exposes per-record before/after history. Run the new backend audit-table migration first. See [Phase 8](docs/PHASE_8_CATALOG_EDITS.md).
