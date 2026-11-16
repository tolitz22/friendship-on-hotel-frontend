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
