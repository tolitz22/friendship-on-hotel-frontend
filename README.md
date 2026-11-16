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
- Reservations calendar with day/week views, status and room-type filters, details drawer, and a searchable list view
- Room inventory with floor and search filters, plus a 7/14-day physical-room timeline
- Guest profiles with search
- Front desk read-only work queue
- Folio/billing list with exact-money formatting
- Housekeeping task list
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
