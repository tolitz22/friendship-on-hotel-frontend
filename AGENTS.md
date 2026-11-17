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
