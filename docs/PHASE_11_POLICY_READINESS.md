# Phase 11 — Reservation policy readiness review

This milestone adds an **advisory, read-only pre-implementation review** of the current hotel booking-policy draft. It does not approve decisions, activate inventory, create reservations, manage holds, compute rates, or determine whether rooms are available.

## New API

```http
GET /api/v1/hotels/{hotel}/reservation-policy-readiness
```

This is protected by the existing Sanctum authentication, active staff account and active hotel membership + hotel:read token permission. It reads only the selected property's latest policy draft. Without a saved draft it assesses the all-null initial state.

Response `data` includes the hotel ID, saved draft revision, `configurationComplete`, `missingFields`, an issue list with stable issue codes and categories, plus **`readyForImplementation: false`**, **`readyForBookings: false`**, and **`approved: false`**. Metadata always contains `diagnosticOnly: true` and `effectiveForBookings: false`.

## What the checker catches

1. All eight missing or invalid preliminary choices.
2. The **potential incompatibility** between selling named physical rooms and assigning the specific room only later.
3. Missing hold expiry / jobs when timed pending holds are chosen.
4. Missing override limits, roles, and audit when overbooking overrides are chosen.
5. Missing cancellation cutoff, fees, refund and inventory-release rules when cutoff-based cancellation is chosen.
6. Missing rate-plan pricing, taxes and snapshots when published rates are selected.
7. Operational specifications that are **always** unresolved in the current schema: status transitions and inventory consumption, atomic room-night concurrency/idempotency, room blocks, guest/financial lifecycle, hotel-local cutoffs and write auditing.

These are **diagnostic issues**, not implied product rules. A completed eight-field draft is not sufficient to implement a booking engine safely. The report does not invent operational values to clear any issue. Do not use `configurationComplete` as an authorization or booking flag.

## Frontend

In `VITE_DATA_SOURCE=api`, open **Booking policies**. The existing draft editor is preserved and now shows **Implementation readiness checks** alongside saved decisions and revision history. Readiness reports evaluate **saved** drafts, not unsaved edits, and refresh after saving. The previous mock Reservations wizard remains unchanged.

## Database parity

The report requires **no new migration**. It reads the existing JSON policy draft and performs comparisons in PHP, so it does not depend on PostgreSQL-only or MySQL-only SQL. Run the feature suite against SQLite, MySQL 8.4/InnoDB and PostgreSQL 16+.

Backend tests: `tests/Feature/ReservationPolicyReadinessTest.php` checks missing choices, full-but-inactive drafts, physical-room assignment mismatch, property access, and absence of booking writes.

Frontend tests: `src/api/reservationPolicy.test.ts` checks scoped readiness transport and real API failures.

## Verification

```powershell
# backend
git pull origin main
php artisan test
php artisan route:list --path=api

# frontend
git pull origin main
npm run typecheck
npm run test
npm run build
```

Source publication does not prove a green CI or working end-to-end browser environment.

## Phase 12 gating requirement

The next real inventory implementation needs hotel-owner agreement on sellable units, assignment timing, status transitions, hold durations, maintenance blocks, no-overbooking/override rules, cancellations, rates and payments. It then needs an approved technical plan for deterministic transactional locking, idempotency, multi-property isolation, inventory release and **simultaneous last-room test cases on both MySQL and PostgreSQL**. This phase does not silently approve those rules.
