# Phase 40 — Exact-Record Reliability and Staff Workflow QA

## What changed

This release fixes concrete data-navigation problems found after Phase 39 instead of adding a new mock module.

### 1. Guest selection is no longer limited to the first 100 results

A guest selected from the live Guest Directory now loads by exact ID through the existing hotel-member API:

GET /api/v1/hotels/{hotel}/guests/{guest}

The booking form verifies the returned hotel ID and guest ID with Zod. When the selected profile is outside the initial first 100 guest records, it is added as a selected option without changing the entire directory pagination or silently substituting another guest. Missing, invalid or cross-property profiles cannot pass the exact guest check.

Files: src/api/liveSelectedGuest.ts, src/api/liveSelectedGuest.test.ts, src/pages/LiveBookingForm.tsx.

### 2. Checkout links to its actual saved cleaning task

A new backend hotel-member read endpoint is available:

GET /api/v1/hotels/{hotel}/bookings/{booking}/turnover

The endpoint verifies the booking belongs to the authenticated hotel and reads its recorded reservation_turnover_links / housekeeping_tasks relation. It returns the real checkout-clean task ID, status and revision, or null if no turnover exists. It explicitly sets determinesRoomReadiness:false and never creates or edits tasks.

The checked-out reservation operations panel now fetches the saved link even after reopening the booking. If found, it opens:

/housekeeping?task=<numeric-task-id>

The Housekeeping route validates numeric task IDs and loads the exact task through the existing hotel-scoped GET /housekeeping-tasks/{task}. This does not depend on which 20-task list page is visible. The existing role checks and expectedRevision still control edits. A missing task displays an API error with a Retry option; no fake task is constructed. Closing the task returns to the normal housekeeping queue.

Files: src/api/liveBookingTurnover.ts, src/api/liveBookingTurnover.test.ts, src/api/liveHousekeeping.ts, src/pages/LiveReservationOperations.tsx, src/pages/LiveHousekeeping.tsx, src/main.tsx.

### 3. Avoid stale readiness checks after operational changes

After staff save housekeeping or maintenance work, the selected hotel's room-readiness queries are invalidated in addition to the existing dashboard and task caches. Laravel still rechecks all readiness blockers transactionally when the optional Phase 36 enforcement policy is active.

### 4. Regression coverage

Backend: tests/Feature/CheckoutTurnoverHandoffPhase40Test.php tests before/after checkout, task identity, member access, another hotel's isolation and absence of implied readiness.

Frontend: src/api/liveSelectedGuest.test.ts and src/api/liveBookingTurnover.test.ts verify exact identity, null task state, task type and false readiness claims.

## Mandatory local verification

Frontend:
- npm install
- npm run typecheck
- npm test
- npm run build

Backend:
- composer install
- php artisan route:list --path=api
- php artisan test --filter=CheckoutTurnoverHandoffPhase40Test
- php artisan test
- php artisan migrate --force (isolated staging/test database only)

GitHub Actions was added in Phase 38, but the available GitHub commit-status interface did not return successful workflow results. These source changes have **not been confirmed passing** TypeScript, Vitest, Laravel, browser acceptance, or cross-process MySQL/PostgreSQL concurrency tests.

## Human acceptance checklist

- Select a guest positioned beyond the first 100 directory records; open Create booking and verify their exact profile.
- Switch hotels while guest selection is open; do not allow another property's profile or booking to be submitted.
- Create a confirmed booking using the unchanged idempotency key guard, assign a room and check in under Laravel's permitted dates.
- Check out, reopen the reservation later and follow the exact saved checkout-clean task, even when many other housekeeping tasks precede it in the queue.
- Edit task under an authorized housekeeping account; verify revision checks and updated readiness blockers.
- Test 401, 403, 404, 409, network timeout, invalid task IDs, changed hotel, and mobile layout.
- Verify that neither housekeeping completion nor task handoff labels a room ready for guests.

The Phase 36 enforced room-readiness gate remains off by default. Do not activate it in a production hotel without the previously documented engine-specific race tests and staff rollout.
