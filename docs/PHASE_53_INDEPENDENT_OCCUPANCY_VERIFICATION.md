# Phase 53 — Independent occupancy verification

## Staff experience

- Manager sees `/occupancy-verification` on their property sidebar, chooses a registered room from the first 100 paged catalogue entries and an active housekeeping verifier, and assigns today's room check using the hotel's API-returned `meta.hotelDate` (not the browser clock).
- Housekeeper sees **only assigned checks**. They submit a factual `occupied`, `vacant` or `unknown` observation and explanatory note. The form never presents expected PMS occupancy before the observation is submitted.
- The manager then sees the recorded observation versus registered checked-in reservations for the same room, the comparison type, actor IDs and audit events. Matches can be verified; discrepancies/unknown readings must be flagged for investigation.
- Each check is single-submission, single-review. The UI shows backend failures, permits query refresh and resets hotel-specific state on property switching.

## Separation of responsibilities

Reception/front desk and maintenance have no occupancy-check navigation or API access. Housekeepers cannot modify booking status, cash receipts or staff roles through these screens. The backend checks active selected-hotel membership, exact assigned user, current property-local date and unique `(hotel,room,date)` constraint.

A discrepancy is **not evidence of employee theft or an unregistered guest**. Managers must investigate using ordinary lawful procedures. Neither staff nor the app should access private rooms without consent and policy compliance. There are no cameras, keycard telemetry, room sensors or real-time access logs connected in Phase 53.

## Rollout and known gaps

1. Deploy backend migration and API before frontend.
2. Run `php artisan test --filter=OccupancyVerificationPhase53Test`, the complete Laravel suite, and MySQL/PostgreSQL concurrency checks.
3. Run `npm test`, `npm run build`, and browser checks on the manager, housekeeper, receptionist, maintenance and cross-hotel roles.
4. The manager room picker loads **at most 100 rooms**. Properties larger than this need paginated room search before rollout.
5. Reviews are manual and manager-triggered. Missing checks are not automatically raised as occupancy anomalies. Daily coverage analytics and random check scheduling are future work.
6. This module does not modify Phase 51 approval events, Phase 52 cash shifts, reservations, payment statuses or room readiness.

The source changes are committed on `main`; passing CI, deployment and physical-verification procedures are **not established** by source commits alone.
