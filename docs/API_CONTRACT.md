# Hotel PMS frontend data contract (draft — must be confirmed with backend)

The entire UI reads through `src/api/queries.ts` → `src/api/index.ts` → an interchangeable `HotelDataSource`.

## Selection

```dotenv
VITE_DATA_SOURCE=mock
VITE_API_URL=http://localhost:8000/api/v1
```

`mock` is the default, and does not call a server. Set `VITE_DATA_SOURCE=api` **only after** Laravel endpoints are implemented; no automatic silent fallback to mock data is used for failed live API calls.

## Response conventions (proposed)

Single: `{ "data": { ... } }`.

Collection: `{ "data": [ ... ], "meta": { "page": 1, "perPage": 20, "total": 4, "totalPages": 1 } }`.

All entity IDs are opaque strings. Date-only hotel stay fields are `YYYY-MM-DD`. Timestamps include an offset. Money uses `{ "amountMinor": 840000, "currency": "PHP" }` (₱8,400.00) and must be backend-calculated. Camel-case wire fields are a **proposed contract**, not an implemented Laravel standard; the API may add explicit mapping in `httpDataSource.ts` if it responds with snake_case.

## Intended GET routes

| Hook | API path |
| --- | --- |
| useDashboard | /dashboard/summary |
| useFrontDeskBoard | /front-desk/board?date=YYYY-MM-DD |
| useReservations | /reservations |
| useReservationCalendar | /reservations/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD |
| useBookingOptions | /booking-drafts/options |
| useBookingQuote | /booking-drafts/quote (provisional GET) |
| useRooms | /rooms |
| useRoomTimeline | /rooms/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD |
| useGuests | /guests |
| useHousekeeping | /housekeeping/tasks |
| useFolios | /folios |

Collections accept `search`, `page`, `per_page`. Rooms also support `floor`.

## Domain safeguards

Room `occupancyStatus`, `housekeepingStatus`, and `maintenanceStatus` are separate. They do not imply room-type availability on future dates. Reservation `assignedRoomId` may be null. The prototype does not mutate or reserve inventory, calculate actual taxes, or store payment card data.

Backend integration steps:
1. Approve API contract and state machine with hotel stakeholders.
2. Build Laravel authentication, authorization, validation, migrations and endpoints.
3. Map actual Laravel response fields into these frontend models (or align Laravel Resources to the contract).
4. Enable API mode and add integration tests, error/empty/loading tests, and safe mutations.

See [reservation calendar contract](RESERVATION_CALENDAR.md) for the half-open date window and room-type metadata.

See [physical room timeline](ROOM_TIMELINE.md) for room-specific blocks, unassigned bookings, and date scope.

See [mock booking wizard](BOOKING_WIZARD.md). These draft options and quote contracts are not yet implemented in Laravel. API mode disables the wizard until business and pricing rules are approved.

See [Front Desk workflow contract](FRONT_DESK.md). Check-in and check-out actions are mock-only; no mutation endpoint is implemented.
