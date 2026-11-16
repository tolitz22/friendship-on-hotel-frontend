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
