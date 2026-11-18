# Independent Room Occupancy Checks & Coverage Report

## Purpose and boundaries
The daily occupancy check compares a **staff physical observation** to **registered checked-in stays at the instant of observation**. It is not live room inventory, room readiness approval, payment verification, or a fraud verdict.

Standard operational separation:
1. A hotel manager assigns a registered room to an active housekeeping employee for the **current hotel-local date**.
2. The assigned employee records what they can **safely and lawfully observe**, choosing occupied, vacant, or unable to verify and providing factual evidence. Do not enter occupied rooms without authorization; do not collect unnecessary personal information.
3. The PMS takes a transactionally consistent registered-stay snapshot when the employee submits the observation. A matching observation remains **pending manager review**, not automatically cleared.
4. A different authorized manager reviews the observation; only a **match** can be verified. Unknown or discrepant observations must be flagged for investigation.
5. The manager coordinates a separate follow-up with front desk and housekeeping; **never automatically create, cancel, check out, move, block or bill a reservation based solely on an observation**.

## UX acceptance
- The occupancy check queue defaults to the **hotel-local current date**. A selected historical date is clearly displayed, and historical assignments cannot be submitted as new observations.
- Manager-only “Assign a room check,” staff “Record observation,” and manager “Review observation” use focused dialogs with explicit actions and validation. No financially or operationally consequential action happens merely by opening a dialog.
- The manager report shows four distinct counts: registered rooms, physically observed, manager reviewed (including flags), and still requiring action (unassigned + assigned + submitted + flagged).
- Detailed report methodology distinguishes **assignment coverage** from **observation coverage**. Historical totals reflect the current room directory; an earlier observation's registered-stay snapshot must not be recomputed from today's bookings.
- Every room result includes understandable status, next step, assigned employee's name, and available observation/review timestamps. Clicking a room opens **that exact room and date**, not a generic list.
- “Flagged” is not the same as a resolved discrepancy, and an unverified observation is not an empty room. Keep both visible as follow-up work.
- On desktop and mobile (390px), check readable cards, tab/keyboard navigation, focus, dialogs, validation messages, status contrast, absence of horizontal page overflow.

## Backend and security acceptance
- Run `php artisan test --filter=OccupancyVerificationPhase53Test` and `php artisan test --filter=OccupancyCoverageReportPhase55Test` using a representative database engine. Verify all migrations and SQL join compatibility.
- Verify staff from another hotel cannot see its checks, that only assigned housekeeping staff can observe, and that only an independent authorized manager can review. Duplicate assignments, duplicate submissions, and replayed reviews must be rejected.
- Verify matching occupied and vacant observations, occupied-versus-registered-vacant, vacant-versus-registered-occupied, and “unable to verify”. Mismatches/unknown must never pass the verified transition.
- Verify clock/day cutoff, concurrent check-in versus observation, pagination, date and room filters, and preservation of audit actor names.
- Do not infer real-time physical occupancy from missing or historical inspections. Report percentages must remain internally consistent; reviewed cannot exceed observed.
- Browser acceptance tests: `npm run test:e2e:staging -- --grep occupancy` with `PMS_STAGING_READ_ONLY=1` and dedicated manager/housekeeping credentials. These tests **do not** submit observations or decisions.

## Limitations to retain honestly
- The room directory used for historical coverage currently represents registered rooms **at report execution time**, not a versioned historical room inventory.
- Flags indicate observations requiring investigation; this workflow records the discrepancy and initial manager decision, but is **not a complete cross-department incident-resolution case-management system**. Closing an incident requires a distinct tracked follow-up design.
- Successful Railway deployment checks demonstrate application build/deployment, **not** completed authenticated production E2E or a real physical-room check.
