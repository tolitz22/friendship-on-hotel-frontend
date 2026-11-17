# Phase 12 — Reservation scenario simulator (non-booking)

This milestone provides a **read-only structural simulation** to inspect how a proposed physical-room stay intersects stored reservation records. No reservations, holds, allocations, room-status changes, prices, or payments are written.

## Endpoint

```http
GET /api/v1/hotels/{hotel}/reservation-simulation?roomId=1&from=2026-11-20&to=2026-11-24
```

Requires an authenticated, active staff member of the selected hotel with the `hotel:read` token ability. Room ID is scoped to the same hotel; cross-property IDs return 404. The query validates strict date-only dates, positive stay and a 31-night maximum.

All structural reservation records of **the selected room's type** overlapping `[from, to)` are loaded, including cancelled or otherwise inactive lifecycle states. Overlap uses `record.check_in < proposed.check_out && record.check_out > proposed.check_in`, so a previous checkout on the proposed check-in does not overlap.

Records are separated into:
- `assignedRoomOverlaps`: records assigned specifically to the selected physical room.
- `unassignedTypeOverlaps`: records within the selected room type lacking a physical room assignment.
- `otherAssignedSameTypeCount`: records assigned to *other* rooms of the same type.

A max of **1,000** matching records is enforced. Exceeding the cap returns HTTP 422 with `complete:false` rather than incorrect truncated results. A normal report declares `complete:true`, `isSimulation:true`, `isAvailability:false`, and `isBookable:false`. Neither a zero-overlap result nor an empty dataset proves availability.

## Why this is not the booking engine

The hotel has **not approved** which lifecycle states consume inventory, holds and their expiry, maintenance/manual blocks, overbooking, rates or idempotent concurrency rules. This simulation makes **no booking decision**; it only displays stored records, independent of the current draft policy. It must not become a preflight bypass for booking commands.

The only endpoint exposed is GET. No POST, PATCH, or DELETE reservation operation was added.

## Frontend

With `VITE_DATA_SOURCE=api`, the sidebar includes **Stay simulator**. Staff select a registered physical room and check-in/checkout dates, then inspect assigned overlaps and unassigned same-type demand. The page explicitly warns that it cannot confirm availability or bookability.

The selector currently displays the **first 100 registered rooms**; a warning is shown when more rooms exist. This is a deliberate pagination limit, not a claim that other rooms do not exist.

The previous mock Reservations calendar and booking wizard remain unchanged and are labeled mock previews. In `VITE_DATA_SOURCE=mock`, the new Stay simulator sidebar item is hidden.

## Tests and compatibility

Backend `tests/Feature/ReservationScenarioTest.php` covers half-open interval boundaries, direct vs unassigned overlaps, foreign-hotel denial, input validation and absence of write routes.

Frontend `src/api/reservationSimulation.test.ts` checks GET query paths, bearer token, hotel-scoping requirement and explicit error propagation.

The backend uses ordinary Eloquent and Laravel query builder syntax for MySQL 8.4/InnoDB and PostgreSQL 16+. No migrations are added.

## Run locally

Backend:

```powershell
git pull origin main
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

The published source and tests require a local/CI run to establish execution success.

## Future milestone

Complete operator-approved booking policies, then implement an actual transactionally locked room-night allocation engine with idempotency, maintenance blocks, expiration, robust status consumption rules and simultaneous last-room tests on MySQL and PostgreSQL. The simulator itself must never change inventory.
