# Phase 41 — Staff UI Stability and CI Hardening

## Scope

This milestone addresses concrete frontend workflow hazards found by reading the live booking and housekeeping implementation. It does not introduce another sample module or change hotel business rules. Source changes have been committed, but **passing CI, browser, database and concurrency results have not been confirmed**.

## Fixes

### Linked guest selection
The booking wizard now treats the exact linked-guest lookup as relevant only while the linked guest remains selected. If an administrator chooses a different guest from the directory, an unrelated failure/loading state from the original guest link no longer blocks or obscures the form. Identity remains validated through the hotel-scoped GET /guests/{id}; a mismatch cannot result in a booking for an unknown profile.

### Cross-hotel asynchronous errors
Housekeeping and maintenance mutation handlers now suppress a late error returned from a property the user has already switched away from. They continue to rely on hotel-scoped API paths, server-side permissions and revision checks. Success handlers already checked the selected hotel. An uncertain mutation result requires manual reconciliation; do not automatically submit a second booking or work order.

### Direct housekeeping task editing
The /housekeeping?task={numeric-id} handoff now shows an explicit Back to task queue action. Opening the exact task is keyed to hotel and task ID, and is done **once per link**. Subsequent TanStack refetches of the same task no longer reset an in-progress editor or wipe unsaved notes, assigned staff, due date or status choices. Selecting a different task or changing hotels opens a new editor context. The edit still uses the saved expectedRevision; Laravel rejects stale writes.

### Checkout task error feedback
The checked-out reservation now offers the exact task link only after the read-only turnover lookup succeeds. A missing linked task is disclosed instead of pretending one exists. A network/authorization failure displays a recoverable error and Retry rather than showing an apparently successful generic handoff.

### Readiness freshness
Real housekeeping and maintenance writes invalidate the selected hotel's room-readiness assessment cache. No task status alone certifies room readiness or changes dated inventory/guest status.

### Confirmed source-level test mismatch
The existing src/api/http.test.ts expected bearer-authenticated fetch options to leave credentials undefined, while src/api/http.ts explicitly uses credentials:'omit' so browser cookies are not sent with bearer-token requests. The assertion has been corrected to require 'omit'; production transport behavior was **not** weakened. This mismatch was confirmed by comparing the test against the implementation; the revised test still needs execution.

### CI strengthening
The backend GitHub Actions workflow now runs php -l over app, routes, database and tests before route registration and the feature suite. The existing SQLite feature tests and MySQL 8.4 migration check remain in place. This adds a syntax gate, not a claim of passing execution.

## Added tests

- src/lib/linkedTaskSelection.test.ts: same hotel/task refetch, different hotel, different task, invalid IDs.
- Existing Phase 40 exact-guest and checkout-task API contract tests remain in the frontend suite.

## Required validation

Frontend:

    npm install
    npm run typecheck
    npm test
    npm run build

Backend:

    composer install
    php artisan route:list --path=api
    php artisan test --filter=CheckoutTurnoverHandoffPhase40Test
    php artisan test

Manual: reproduce an edit in the direct cleaning task dialog, trigger a data refetch from a second staff account, and ensure unsaved changes remain visible. Submit from the old revision and confirm 409 tells staff to reopen current state. Change property while a housekeeping or maintenance request is in flight and ensure no previous-property alert appears. Change the guest selected in a booking form while the original direct guest lookup is failing. Simulate failed turnover fetch and verify no false task-link success.

**Status:** Source committed. Neither GitHub workflow checks nor the above commands were confirmed passing in this session. MySQL/PostgreSQL multi-process readiness race tests and browser accessibility review remain required before production rollout.

## Next recommended work

Obtain and fix actual GitHub Actions errors, generate and commit a verified frontend package-lock.json for reproducible npm ci, exercise the staff workflow in an automated browser, and validate the opt-in check-in gate with separate-process DB tests on the target production engine.
