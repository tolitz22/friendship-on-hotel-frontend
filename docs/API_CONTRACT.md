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
| useHotelSettings | /settings/overview |
| useFrontDeskBoard | /front-desk/board?date=YYYY-MM-DD |
| useReservations | /reservations |
| useReservationCalendar | /reservations/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD |
| useBookingOptions | /booking-drafts/options |
| useBookingQuote | /booking-drafts/quote (provisional GET) |
| useRooms | /rooms |
| useRoomTimeline | /rooms/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD |
| useGuests | /guests |
| useHousekeeping | /housekeeping/tasks |
| useHousekeepingBoard | /housekeeping/board |
| useMaintenanceBoard | /maintenance/board |
| useReports | /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD |
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

See [Housekeeping board contract](HOUSEKEEPING.md). Draft task updates only affect local React state in mock mode; no mutation API exists yet.

See [maintenance board](MAINTENANCE.md). Technician and status changes are local preview state only; room maintenance and inventory remain unchanged.

See [Reports and Analytics](REPORTS.md) for definitions of date-filtered arrival bookings versus present-state room/folio snapshots.

See [Hotel Settings contract](SETTINGS.md). In mock mode property form changes are only local previews; room types and staff permissions are read-only. There are no live update endpoints.

## Phase 5 integration status

`VITE_DATA_SOURCE=api` now supports **login + hotel selection + live guest records only**. The other `HotelDataSource` methods are deliberately bound to explicit mock previews for this interim phase. Live Guests uses property-scoped routes:

- `POST /auth/login` (not on `HotelDataSource`)
- `GET /auth/me` and `POST /auth/logout`
- `GET /hotels/{hotel}/guests` with `search`, `page`, `per_page`
- `POST /hotels/{hotel}/guests` and `PATCH /hotels/{hotel}/guests/{guest}` for authorized admins

The earlier `/guests` row in the proposed endpoint table is superseded for API mode by these scoped URLs. No other existing proposed endpoint may be assumed to be live. See [Phase 5](PHASE_5_LARAVEL_INTEGRATION.md).


## Phase 26: Read-only live folio lookup in API-mode Billing

In `VITE_DATA_SOURCE=api`, Billing renders **a distinct live lookup** for a manually supplied priced reservation ID using `src/api/liveFinance.ts` and the existing selected-hotel in-memory/cookie session. The endpoint is:

```http
GET /hotels/{hotel}/bookings/{booking}/folio-ledger
```

It returns the backend's `summary` containing `roomSubtotalMinor`, `additionalDebitsMinor`, `creditsMinor`, `pendingReviewPaymentsMinor`, `staffConfirmedPaymentsMinor`, `provisionalDifferenceMinor`, `finalPayableTotalKnown:false`, `bankOrGatewayVerified:false`, and `isSettled:false`. This is **not** a legally payable or verified settlement amount. Loading and failure states are visible; no silent fixture fallback occurs. The existing `listFolios` table **remains sample/demo** because the Laravel backend does not provide the same full list contract.

No frontend mutation flow for rate policies, payments, adjustments or refunds has been enabled. Their backend Phase 26 routes are for authenticated administrator use only and remain provisional. See the backend `docs/PHASE_26_FINANCE_POLICY_AND_REFUNDS.md`.


## Phase 29 live Front Desk adapter

The implemented Laravel endpoint is `GET /hotels/{hotel}/front-desk/manifest` with `date`, `kind=arrivals|departures|in_house`, `page` and `per_page`. The frontend now uses it in API mode via `src/api/liveFrontDesk.ts` and `src/pages/LiveFrontDesk.tsx`. Unlike the earlier hypothetical `/front-desk/board` response, the real manifest provides a **paginated flat list** of reservation identity, nullable guest name/assigned room, dates and lifecycle status, plus `determinesHousekeepingReadiness:false`. The mock board contract stays available solely in mock mode.

In API mode the Front Desk page has three independent live queues, property-scoped query keys, pagination and local search of the current page. There is no API-to-mock fallback and no live check-in or checkout mutation. Other modules still follow their explicit mock/live split. See `docs/FRONT_DESK.md` for precise behavior.


## Frontend Phase 30 — Live reservation records, availability and rate quote preview

With `VITE_DATA_SOURCE=api`, `src/pages/Reservations.tsx` renders `LiveReservations`; mock mode continues to use the original calendar, reservation detail and non-persistent booking wizard. `src/api/liveReservations.ts` validates these **implemented** Laravel hotel-scoped read endpoints using Zod:

```http
GET /hotels/{hotel}/reservation-records?page=1&per_page=20
GET /hotels/{hotel}/room-types
GET /hotels/{hotel}/rate-plans
GET /hotels/{hotel}/room-type-availability?roomTypeId=...&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
GET /hotels/{hotel}/room-quotes?roomTypeId=...&ratePlanId=...&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
```

The reservation list is **structural** and paginated: `id`, `hotelId`, `reference`, `roomTypeId`, nullable `assignedRoomId`, date range, nullable/legacy `lifecycleState`. It does NOT contain a guest name, price, room name or booking eligibility. Do not map it to the richer demo `Reservation` type or show the old mock calendar in live mode. Local search filters only the currently loaded page, and server totals are displayed.

Availability returns dated physical-room capacity, reserved and maintenance-blocked counts and a momentary `canBook` for the entire stay. It is **not a room hold**, does not certify housekeeping, and may change before booking creation. The quote returns a fixed-rate **room subtotal only**, never final payable amount or paid balance; taxes, fees, deposits and discount computation are excluded. The UI explicitly warns about these limitations. Quote and inventory are separate requests, so one may fail while the other succeeds.

All queries use the selected authenticated hotel ID in their TanStack Query keys; invalid responses and HTTP failures are exposed rather than falling back to mock data. The preview is read-only: there is **no live booking submission, cancellation, payment, rate edit, or check-in/out action**.

Tests: `src/api/liveReservations.test.ts` covers schema validity, per-hotel identity, stay range, nightly blocks, quote identity and nonfinal financial flags. Validate with `npm ci && npm run typecheck && npm test && npm run build`, plus a real browser session against the migrated Laravel backend. Actual CI/test success is not confirmed in this repository write session.


## Frontend Phase 31 — Live administrator booking creation

In `VITE_DATA_SOURCE=api`, the Reservations screen now renders `src/pages/LiveBookingForm.tsx` next to the already-live, read-only reservation list and availability/rate preview. The form uses the authenticated selected-hotel guest list, room types, active rate plans, nightly availability and subtotal quote, then submits **a real booking** to the implemented Laravel admin-only endpoint:

```http
POST /api/v1/hotels/{hotel}/bookings
Content-Type: application/json

{"idempotencyKey":"unique-random-uuid","guestId":23,"roomTypeId":9,"ratePlanId":7,"checkIn":"2026-12-10","checkOut":"2026-12-12"}
```

The frontend only exposes this submission to users marked as administrator for the selected hotel; **Laravel enforces `hotel.admin` and `hotel:write` regardless of frontend display**. Only stays of 1–31 nights, an existing visible guest, an active rate plan and a positive available night-by-night inventory preview are eligible for submission. The server revalidates inventory and rate under its booking transaction, so preview does not reserve/guarantee anything.

The UI produces an independent random idempotency key per new booking and freezes the entire request before sending it. If the network or backend result is uncertain, the UI **retains the same key and immutable data**, disables edits and offers retry of that exact request. Replays return the original reservation with `idempotentReplay:true`. Staff may explicitly abandon the local attempt **only after verifying the hotel records**, as a booking might already have committed. Request keys are held in memory only; browser reloads lose them, and staff must reconcile before making another booking after an interrupted session. No payment is taken, no physical room is assigned, and the folio contains **room-night snapshots without a tax-complete final payable total**.

Upon a valid `confirmed` response, the UI displays the Laravel-generated booking reference and reservation ID; it invalidates cached reservation lists, availability and front-desk manifests for the hotel. Cache invalidation failure cannot turn an already-confirmed response into a failed booking. Switching hotels while the request is pending cannot show the previous hotel's confirmation.

The original mock-mode booking wizard remains simulated. New API contracts are isolated to `src/api/liveBooking.ts`; `src/api/liveBooking.test.ts` covers payload precision, idempotency replay, tenant-scope response validation and failure cases.

### Verification

```bash
git pull origin main
npm ci
npm run typecheck
npm test
npm run build
```

Against a migrated Laravel test/staging backend, confirm admin creation, backend 403 for nonadmins, 409 for no inventory, 404 for wrong-property guest/rate, identical retry (one reservation/folio), conflict on a reused key with different fields, property switch, network timeout after server commit, and subsequent inventory/manifest updates. The current GitHub write environment has **not run** the frontend test/build suite or cross-service browser acceptance tests.

**Still excluded:** taxes, final payable amount, real money handling, refunds, guest identity verification, room assignment, automated check-in/out, housekeeping readiness and user-facing customer booking.


## Frontend Phase 32 — Room assignment, lifecycle operations and real audit history

In `VITE_DATA_SOURCE=api`, the saved reservation list can open `LiveReservationOperations` for a selected real structural reservation. The existing mock-mode reservation calendar/detail/wizard are unchanged. The frontend uses `src/api/liveReservationOperations.ts` with Zod-validated, hotel-scoped calls to these **implemented** Laravel endpoints:

```http
GET   /hotels/{hotel}/rooms?page=1&per_page=100
GET   /hotels/{hotel}/inventory-blocks?roomId=123&per_page=100
PATCH /hotels/{hotel}/bookings/{booking}/assign-room
POST  /hotels/{hotel}/bookings/{booking}/check-in
POST  /hotels/{hotel}/bookings/{booking}/check-out
GET   /hotels/{hotel}/bookings/{booking}/history?page=1&per_page=20
```

The last `/history` read-only endpoint is a **small Phase 32 backend support addition** (`ReservationHistoryController`); it returns scoped booking events in descending event-ID order, with event type, previous/new state, actor ID, recorded timestamp, and paging metadata. It does not claim readiness, transaction settlement, or a complete financial history. Backend test: `ReservationHistoryPhase32Test`.

Only the selected hotel's authenticated admins see mutation controls. Laravel `hotel.admin` remains authoritative; the history read requires an active hotel member. Staff select a physical room from the server-side paginated room catalogue filtered locally to the booking's room type. Room-block history is also consulted; incomplete block pagination prevents assignment from this UI, and overlapping active blocks disable the button. **Neither list guarantees eligibility**; Laravel rechecks assignment collisions and current room blocks in its transaction. Physical room assignment can be changed for `confirmed` reservations only.

Check-in requires an assigned room and hotel-calendar date within the scheduled stay, excluding departure. Check-out requires `checked_in` and hotel-calendar date on or after checkout. The UI requires a staff acknowledgement for identity/room-readiness or departure follow-up; this acknowledgement is **not stored or verified by the backend**. Laravel rechecks status, assignment, collisions, block dates and hotel-local timing; these are the authoritative rules. Successful checkout creates a `checkout_clean` housekeeping task **on the backend**, but task completion, maintenance readiness, guest identity and monetary settlement remain separate workflows.

The UI validates hotel/booking/room/status identities on mutation responses, never retries irreversible mutations automatically, shows API/409/403 errors, and refreshes reservation records, front desk manifests, inventory, rooms and history after successful operations. A cache refresh failure never implies a committed operation failed. The frontend suppresses results after a property switch and never quietly falls back to demo records.

### Verification

```bash
# frontend
git pull origin main
npm ci
npm run typecheck
npm test
npm run build

# backend
git pull origin main
php artisan test --filter=ReservationHistoryPhase32Test
php artisan test
```

Use an isolated migrated backend and authorized member/admin accounts. Test full room catalogues, real room conflicts, overlapping maintenance blocks, 409 stale-state errors, early checkout, duplicate check-in, property switches and the resulting turnover task. **Tests/build and browser acceptance have not been confirmed passing in this environment.**

**Still outside Phase 32:** audit filtering by a specific actor and financial charge/refund ledger, verified housekeeping readiness, guest ID workflow, early checkout settlement/amendments, physical key distribution, and public booking.
