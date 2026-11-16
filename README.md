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
- Other navigation modules remain placeholders

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
