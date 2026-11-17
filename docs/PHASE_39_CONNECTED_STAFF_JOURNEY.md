# Phase 39 — Connected Front Desk Staff Journey

## Goal

Use real hotel data to connect guest selection, booking creation, room assignment, check-in, checkout and housekeeping turnover without requiring staff to search for the same booking on multiple paginated pages.

## Implemented

- **Guests to booking:** eligible hotel admins can select Create booking from a guest row. The Reservations route accepts a validated numeric guest query parameter. The booking form preselects the guest when available within its first 100 loaded profiles and explains when it is not.
- **Saved booking to exact reservation:** after creation, Open this booking links to the actual reservation ID, not an arbitrary list page. The existing idempotent booking retry safeguards remain.
- **Front Desk to exact reservation:** arrivals/departures/in-house manifest rows have Manage this booking deep links with the exact booking ID.
- **Hotel-scoped Laravel GET:** /api/v1/hotels/{hotel}/reservation-records/{booking}. Uses the hotel reservation relation and existing active hotel member authorization. Returns only structural booking fields, not guest PII or financial settlement claims.
- **Focused booking view:** Reservations reads a validated booking ID from the router, fetches that exact record under a hotel-specific TanStack query key, and shows the operations panel before other booking forms and tables. Read errors have an explicit retry action.
- **Progress and handoff:** the operations panel shows stages for confirmed booking, room assignment, guest stay and cleaning handoff. Checkout directs staff to the live Housekeeping queue.
- **Cache coherence:** assignment, check-in and checkout invalidate the exact record along with existing manifest, reservation list and readiness queries.

## Important limits

This workflow never bypasses hotel administrator authorization for booking creation or lifecycle mutations. Laravel remains authoritative for room collision, stay dates and the opt-in independent room-readiness gate. Staff identity acknowledgement is not stored as independent verification. Checkout creates a checkout-clean task but does not certify a room as ready. The workflow does not collect money, verify guests independently, or generate a complete tax invoice.

A numeric booking ID in a link is not authorization: every direct GET must pass the selected-hotel membership middleware and hotel-scoped record lookup.

## Acceptance checklist

1. Select Create booking from Guest directory; verify preselected guest and property scope.
2. Complete booking and open its exact ID even if absent from the currently loaded 20-row reservation page.
3. Open each Front Desk manifest booking directly; verify match with the displayed reference.
4. Assign a physical room; verify detail refresh and correct room.
5. Check in only during permitted window and with the enabled readiness policy satisfied.
6. Check out and follow Open cleaning tasks; confirm checkout-clean exists.
7. Test invalid and cross-hotel record IDs, 401/403/409 errors, network timeouts, property switches and mobile screens.
8. Test booking idempotency under uncertain network outcomes; do not create duplicate bookings.

## Verification commands

Backend: composer install; php artisan test --filter=DirectReservationWorkflowPhase39Test; php artisan test.
Frontend: npm install; npm run typecheck; npm test; npm run build.

Source commits have been made, but passing CI runs, TypeScript build, full Laravel suite, browser acceptance and database concurrency tests have not been verified here.
