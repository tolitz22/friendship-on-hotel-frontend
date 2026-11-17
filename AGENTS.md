# Friendship On Hotel — Frontend Development Instructions

Stack: React/Vite/TypeScript strict, TanStack Router/Query, Tailwind CSS 4, accessible reusable components. **Do not switch to Next.js.**

## API-first UI architecture
- Models: `src/api/types.ts`
- Query hooks: `src/api/queries.ts`
- API selection: `src/api/index.ts` controlled by `VITE_DATA_SOURCE=mock|api`
- Mock adapter: `src/api/mock/dataSource.ts`
- HTTP adapter: `src/api/httpDataSource.ts`
- API contract: `docs/API_CONTRACT.md`
- UI components must not import `src/api/mock/fixtures.ts` directly.
- No silent API-to-mock fallback; live errors must remain visible.

## Domain restrictions
Room occupancy, maintenance, housekeeping and future reservation availability are independent. Room assignment can be null. Money is backend-authoritative and represented as minor units on the wire.
Do not implement reservation edits, payments, refunds, check-in, housekeeping transitions or inventory writes until policies are approved. Keep mock actions clearly disabled.

## UI standards
Follow `docs/DESIGN_SYSTEM.md` for charcoal/orange/white brand and both light and dark modes. Use status text as well as color. Accessible labels, keyboard operation, responsive layout, and loading/empty/error states are required.

## Quality
Run typechecks/build/tests where possible and report actual results without inventing success. Use isolated, testable modules and preserve separation between backend and frontend repositories. Never check in secrets or real guest information.

## Front desk milestone

Follow `docs/FRONT_DESK.md`. The `useFrontDeskBoard(date)` query provides date-scoped arrivals, departures and in-house sample entries. OperationPreview is a non-mutating checklist, not a state transition, authorization, key handover or financial action. Keep mock-only demos disabled under live API mode until backend authorization and transition rules are implemented.

## Housekeeping preview

Read `docs/HOUSEKEEPING.md`. Task board mock draft changes are ephemeral component state, not API writes. Task status does not imply housekeeping or room availability status. Keep all real status/assignment mutations disabled until backend authorization, policy, audit and concurrency rules are defined.

## Maintenance preview

Review `docs/MAINTENANCE.md` and maintain work orders separately from actual inventory blocks. `useMaintenanceBoard()` has a mock adapter and proposed API GET route. In mock mode, edits stay local; in API mode all mutation inputs are disabled. Never change room availability or check-in eligibility as a side effect of sample work-order transitions.

## Reports & Analytics

Read `docs/REPORTS.md`. All reporting data is mock/read-only at this stage; distinguish check-in-date filtered booking metrics from current room/housekeeping snapshots and all-record folio totals. Do not label gross booking totals or payments as recognized revenue. Report formulas and permissions are ultimately backend-authoritative.

## Settings milestone

Follow `docs/SETTINGS.md`. The Settings page uses `useHotelSettings()` and local validation only; do not add server-side configuration changes or permissions based on sample role labels. Confirm property identity, timezone, inventory schema, and RBAC through discovery before implementing Laravel update endpoints.

## Phase 5 Laravel integration

Read `docs/PHASE_5_LARAVEL_INTEGRATION.md`. In API mode, staff must sign in and choose an authorized hotel; only Guests uses Laravel. Other modules remain explicitly labeled mock previews. Never silently fall back to fixtures when live guest requests fail, or persist bearer tokens to browser localStorage/sessionStorage. Do not treat the current in-memory token flow as production browser authentication. Preserve all existing mocked PMS screens and do not add booking writes until inventory rules are approved.


## Frontend Phase 29 — Real Front Desk manifest in API mode

Read `docs/FRONT_DESK.md` Phase 29 section. `src/pages/FrontDesk.tsx` renders the mock component in `mock` mode but a separate `LiveFrontDesk` component in `api` mode. `src/api/liveFrontDesk.ts` validates the actual Laravel selected-hotel manifest payload using Zod; each kind uses server pagination and reports counts from server metadata. Never invent missing room type, prices, guest or housekeeping readiness. All live check-in/checkout, room assignment, payment, and housekeeping actions are still disabled. Do not silently fall back to fixture data on errors. Include hotel ID in query keys and reset pagination on date changes.


## Frontend Phase 30 — Live read-only Reservations

Read `docs/API_CONTRACT.md` Phase 30. In API mode `src/pages/Reservations.tsx` selects `LiveReservations` with validated real hotel-scoped structural reservations, rate plans, room types, dated availability and separate room subtotal quotes. Do not reuse mock calendar/detail/wizard types for live records, do not assume guest names/room readiness, and never show room subtotal as a final payable amount. Query keys include hotel and stay/rate IDs. Date range 1–31 nights, no room held, all mutations disabled. Mock mode keeps the original screens. Preserve no-fallback error behavior.


## Frontend Phase 31 — Actual administrator booking creation

See `docs/API_CONTRACT.md` Phase 31 and `src/pages/LiveBookingForm.tsx`. In API mode, hotel administrators can create a Laravel `confirmed` booking via `POST /hotels/{hotel}/bookings` after selecting an existing guest, valid stay, room type and active rate plan and reviewing read-only inventory/room subtotal. Laravel is the final authority for eligibility, capacity, rate and admin permission. Each first attempt uses one random idempotency key and frozen input. On uncertain errors, retry **only the identical body/key**; never create a new key automatically. After confirmed success, show the server-generated reference and refresh selected-hotel records. The booking's physical room is still unassigned; no payment, room-readiness verification or tax-complete payable total exists. A browser reload loses the in-memory attempt key; warn staff to reconcile before resubmitting. Mock-mode wizard is still non-persistent. Do not turn this into a public guest checkout or automatically issue invoices or mark rooms ready.


## Frontend Phase 32 — Real room assignment and reservation lifecycle

Read `docs/API_CONTRACT.md` Phase 32. `LiveReservationOperations` is opened from a real reservation record in API mode. Only selected-hotel administrators receive mutation controls. Laravel remains the authority for room assignment, dated maintenance blocks, check-in/out transitions and early-departure restrictions. The frontend consults the hotel-scoped room catalog and dated blocks; it does **not** assert housekeeping readiness or successful settlement. Admin confirmations are UI acknowledgements only, not persisted identity/readiness checks. The read-only booking event timeline is sourced from the new backend `GET /bookings/{booking}/history` route, not mocked. Never silently retry assignments/check-in/check-out; after ambiguous errors, refresh and verify the reservation state. Invalidate selected-hotel reservation, front-desk, inventory, room and audit caches on successful state change. Mock mode retains existing previews.
