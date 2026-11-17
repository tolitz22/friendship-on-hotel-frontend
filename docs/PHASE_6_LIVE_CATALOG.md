# Phase 6 — Live Dashboard Catalogue, Room Inventory and Settings

## What is genuinely live

When `VITE_DATA_SOURCE=api`, existing Laravel staff sign-in and hotel selection remain mandatory. **Four** areas now use hotel-scoped Laravel data:

1. **Guests** — live directory and admin create/edit (Phase 5)
2. **Overview** — registered physical room count, room type count, floor count and selected property details
3. **Room Inventory** — live room list, room number search, floor filter and pagination
4. **Settings** — read-only hotel contact details, currency/timezone, real room type counts and registered floors

None of these read-only catalogue endpoints grants availability, current occupancy, room readiness, daily arrivals, rates, revenue or reservation status.

The existing mock UI remains accessible through `VITE_DATA_SOURCE=mock`. In API mode all other operational modules deliberately remain explicit previews, not fake live numbers.

## New backend endpoint

```http
GET /api/v1/hotels/{hotel}/catalog-summary
```

Response shape:

```json
{
 "data": {
  "hotelId": "1",
  "totalRooms": 3,
  "totalRoomTypes": 2,
  "floors": [{"number": 1, "roomCount": 2}, {"number": 2, "roomCount": 1}],
  "roomTypes": [{"id": "4", "name": "Standard", "maxOccupancy": 2, "roomCount": 2}]
 },
 "meta": {"isAvailability": false, "isOccupancy": false, "scope": "physical_room_catalog"}
}
```

This query uses only catalogue table counts and is property-scoped by active membership. No booking status, holds, housekeeping or occupancy calculations are included.

## Existing Laravel APIs used

- `GET /api/v1/hotels/{hotel}` — saved property name, contact details, timezone and currency
- `GET /api/v1/hotels/{hotel}/rooms?page=1&per_page=24&floor=1&search=101` — paginated physical rooms; server validates floor, page, size and room-number search
- `GET /api/v1/hotels/{hotel}/catalog-summary` — aggregate catalogue read model
- Previous `/hotels/{hotel}/guests` APIs remain unchanged

All live queries include the selected hotel in the TanStack Query key and are cleared when switching hotels or signing out. No automatic fallback to mock data on API failures.

## Backwards compatibility

The old mock Dashboard, Rooms grid/timeline and Settings screen are preserved, unmodified, and available in `VITE_DATA_SOURCE=mock`. In API mode separate `LiveDashboard`, `LiveRooms`, `LiveSettings` components are shown, to avoid misleading operational fields in the old `Room` and `HotelSettingsResponse` interfaces.

The header shows `LIVE CATALOG` on Overview, Room Inventory, Settings and Guests (with guest-specific live data); it continues showing `MOCK PREVIEW` on Reservations, Front Desk, Billing, Housekeeping, Maintenance and Reports.

## Configuration

Backend `.env` should allow `FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` and use `DB_CONNECTION=mysql` or `pgsql`.

Frontend `.env`:

```dotenv
VITE_DATA_SOURCE=api
VITE_API_URL=http://localhost:8000/api/v1
```

Restart Vite after changing mode. Run `php artisan migrate` only if earlier backend migrations remain outstanding; **Phase 6 requires no new tables**.

## Quality checks

Backend:

```powershell
git pull origin main
php artisan test
php artisan route:list --path=api
```

Frontend:

```powershell
git pull origin main
npm run typecheck
npm run test
npm run build
npm run dev
```

Run the frontend and verify room counts against manually-created room records in the selected hotel. Tests added for scoped aggregation, filter validation and client request paths. Local runtime and browser validation remain necessary.

## Next milestones

- Permission-reviewed administrative property and room catalogue mutations in the UI.
- Production browser session design and audit logs before handling real personal data.
- Confirm inventory sold (room type/physical room/hybrid), assignment timing, hold behavior, status policy and overbooking before implementing any reservation writes or occupancy calculations.
