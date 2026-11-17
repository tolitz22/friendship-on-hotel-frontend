# Phase 9 — Structural reservation-demand reporting and booking-policy decisions

Status: backend and read-only frontend source published. No booking mutation, occupancy decision or available-room determination has been enabled.

## New hotel-scoped endpoint

```http
GET /api/v1/hotels/{hotel}/reservation-demand?from=2026-11-17&to=2026-11-24
```

Requires Sanctum authentication, active staff account, a token with `hotel:read`, and active membership in the selected hotel. Date-only stay semantics are **half open** `[from,to)`: a departure on the 20th does not consume the night of the 20th.

The reporting window is **1–31 nights**. All stored `reservation_records` whose stays intersect the window are counted, irrespective of `lifecycle_state`. This includes provisional/cancelled/no-show records because the hotel has not approved which lifecycle states consume actual inventory. Both physically assigned and unassigned room-type records are represented. Reporting fails with HTTP 422 if more than 1,000 matching structural records exist; it never silently truncates a diagnostic.

Sample response (illustrative only):

```json
{
  "data": {
    "days": [
      {
        "date": "2026-11-17",
        "roomTypes": [
          {
            "roomTypeId": "1",
            "roomTypeName": "Standard",
            "registeredRooms": 10,
            "totalRecords": 2,
            "assignedRecords": 1,
            "unassignedRecords": 1
          }
        ]
      }
    ],
    "matchingRecordCount": 2
  },
  "meta": {
    "hotelId": "1",
    "from": "2026-11-17",
    "to": "2026-11-18",
    "timeZone": "Asia/Manila",
    "complete": true,
    "isAvailability": false,
    "isOccupancy": false,
    "scope": "structural_reservation_demand_all_states",
    "warnings": [
      "Every lifecycle state is included: inventory-consuming statuses are not approved.",
      "Registered rooms are not sellable inventory or vacancy.",
      "No holds, maintenance blocks, overbooking rules or capacity allocator is applied."
    ]
  }
}
```

**IMPORTANT:** It is mathematically incorrect to subtract `totalRecords` from `registeredRooms` to obtain availability. The report includes every lifecycle state and lacks maintenance, holds, allocation, overbooking rules, and concurrency handling. Neither an empty report nor a zero-overlap period authorizes a booking.

## Frontend

In `VITE_DATA_SOURCE=api`, the sidebar has a new **Demand diagnostic** page. Staff can choose inclusive start and exclusive end dates and inspect a per-night, per-room-type table of counts. The warnings remain visible with the results.

The existing Reservations calendar and wizard are still explicitly labeled **MOCK PREVIEW**. The demand diagnostic does not replace or secretly enable those workflows. In `VITE_DATA_SOURCE=mock`, the new sidebar entry is hidden; prior demo views remain preserved.

## Booking-policy decision log — owner approval required

Before enabling reservations, the hotel needs to choose and approve each rule:

| Decision | Options to approve | What it controls |
| --- | --- | --- |
| Sellable unit | Physical room / room type / hybrid | Inventory counters, locking strategy |
| Physical room assignment | At booking / before arrival / at check-in | Unassigned bookings and moves |
| Inventory-consuming statuses | Tentative, pending, confirmed, checked in, no-show, cancelled | Whether a record blocks inventory |
| Holds | None / expiring timed holds | Expiry jobs, prevention of oversells |
| Maintenance and manual blocks | Per-night out-of-service inventory | Capacity deduction, operations |
| Overbooking | Disallowed / approved override | Response codes, audit |
| Cancellation and amendment | Deadlines, fees, slot release, atomic date changes | Reservation state machine |
| Guest linkage | Required primary guest / guest accounts optional | Identity rules and privacy |
| Payment and rate policies | Deposit, tax, refunds, rate plans | Real quoted amounts and folios |
| Concurrency and retry semantics | Atomic locks, idempotency, rate limiting | Double-booking prevention |

None of these are inferred from the mock booking wizard.

## Engine parity and testing

The backend uses the portable query builder to fetch matching stays and groups in PHP, not a PostgreSQL-only range type, exclusion constraint, or MySQL-only SQL syntax. The query uses the existing `res_hotel_stay_idx`. Regression tests verify half-open dates, unassigned and assigned counts, property isolation, authorization, invalid windows, and the absence of reservation writes.

Frontend tests ensure selected-hotel query paths, bearer headers, and error propagation without mock fallback.

Run:

```powershell
# Laravel repository
git pull origin main
php artisan test
php artisan route:list --path=api

# React repository
git pull origin main
npm run typecheck
npm run test
npm run build
```

Phase 9 has **no new database migrations**. Existing MySQL 8.4 and PostgreSQL 16 CI jobs should validate the same backend feature suite.

## Recommended Phase 10

Approve booking rules, then build a **real transactional inventory allocator** using the selected policy, deterministic lock order, idempotent create endpoints, and concurrent-last-room tests on **both MySQL/InnoDB and PostgreSQL** before connecting the real booking wizard.
