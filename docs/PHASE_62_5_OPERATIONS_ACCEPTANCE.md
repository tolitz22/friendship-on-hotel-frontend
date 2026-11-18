# Phase 62.5 — Hotel operations acceptance and release gate

**Release status: IN PROGRESS — not signed off.** A successful deployment does not replace end-to-end verification. This checklist is for a **disposable hotel and isolated database**, never a real guest, live drawer, tax record, or production payment.

## Automated backend contracts

The Laravel `backend.yml` workflow now names the critical Phase 62.5 test suite explicitly, followed by the full application test suite. Full tests also run on isolated PostgreSQL 16 and MySQL 8.4 test databases.

| Scenario | Existing automated evidence | Release-critical assertions |
| --- | --- | --- |
| 1. Reservation → room assignment → arrival | `Phase43RealWorkflowAcceptanceTest.php`, `DirectReservationWorkflowPhase39Test.php`, `RoomReadinessPhase35Test.php`, `Phase625OperationalBoundaryTest.php` | One room cannot be allocated to overlapping stays; retries are idempotent; a failed inspection does not pass; submitter cannot approve own inspection; no check-in to a blocked room |
| 2. Cash receipt and folio settlement | `Phase43RealWorkflowAcceptanceTest.php`, `CashierShiftPhase52Test.php`, `FolioSettlementIntegrationTest.php` | Cash receipt must have a priced booking, current cashier's open shift and unique idempotency reference; only net amount is posted (not tendered cash); cashier cannot reconcile their own drawer; discrepancies and unreviewed payments block clean reconciliation |
| 3. Guest departure and turnover | `Phase43RealWorkflowAcceptanceTest.php`, `HousekeepingTasksTest.php`, `RoomReadinessPhase35Test.php` | Checkout is rejected when prerequisites fail; one departure creates the correct turnover record; completing cleaning does not by itself mark a room inspected or available |
| 4. Independent physical occupancy and investigation | `OccupancyVerificationPhase53Test.php`, `OccupancyCoverageReportPhase55Test.php`, `Phase625OperationalBoundaryTest.php` | Manager assigns; assigned housekeeping observes; independent manager reviews; unknown/mismatched observations cannot become verified; closed investigations retain original flags and audit history; no reservation/payment is automatically created or modified |
| 5. Business day close and audit reconciliation | `FinancialBusinessDayIntegrationTest.php`, `NightAuditFinancialReportTest.php`, `FolioNightAssessmentIntegrationTest.php` | Every posted journal balances; missing periods or mismatches prevent day close; repeated close cannot advance the clock twice; historical journal dates are immutable and corrections use proper reversal transactions |

The new `Phase625OperationalBoundaryTest.php` checks a **combined operational boundary**, not just isolated API pages: inspection submission and independent approval followed by an independent occupancy mismatch and manager flag, ensuring that approval and occupancy evidence cannot create bookings or payments.

The expanded `CashierShiftPhase52Test.php` checks that the `/cashier-shifts/current` endpoint always returns **the authenticated employee's** drawer, including administrators who can see hotel-wide cashier history.

## Manual staging — mandatory before production cash/checkout

Use **two different administrator accounts**, one front-desk cashier, one assigned housekeeping employee, one fictional guest, and a disposable hotel. Both the web frontend and backend must point to the isolated test database.

1. Create one guest and a two-night reservation. Confirm visible dates, room price, room assignment, audit actor names, same-room double-booking prevention, and check-in enforcement.
2. Open a cashier shift as the cashier. Collect a test payment of ₱2,500 with ₱3,000 tendered. Confirm **₱500 change** and **exactly ₱2,500 posted** once, using the same idempotency key on a repeated request. Verify receipt linkage. Submit drawer and have a **different manager** review payment and reconcile.
3. Check out the guest after satisfying checkout rules. Verify a cleaning task is created. Complete the task and verify the room is **not** automatically inspection-approved. Submit inspection as Manager A, approve as Manager B, and ensure the audit shows both names.
4. Independently assign an occupancy check to housekeeping. Record an observed mismatch; verify Manager A cannot mark it matched. Flag it, open an investigation, record findings, and close through Manager B. Confirm bookings/payments remain unchanged and the report distinguishes closed follow-up from historical flagged observation.
5. Review the financial business date, postings, tax flags, payment review states, and overnight revenue. Attempt closing with a discrepancy (must be blocked). Close one valid synthetic business date, retry (must not advance twice), and confirm subsequent posting uses the new day.

### UI acceptance

- **Desktop 1440×900 and mobile 390×844**: no document-level horizontal overflow or unusable controls.
- Every primary page has one prominent next action; financial adjustments, payment entry, room observation and end-shift count use task-focused dialogs.
- A disabled action explains **why**, including independent-review requirements.
- Audit displays readable employee names, human-readable timestamps, and recorded before/after changes. Missing historical information is identified as unavailable rather than invented.
- Loading, empty, permission denied, network error and retry states are distinct.
- Physical occupancy observations do not claim fraud, bank settlement or current inventory availability.

### Browser execution safety

Read-only smoke tests use `npm run test:e2e:staging` and `PMS_STAGING_READ_ONLY=1` with dedicated role accounts. A manually dispatched GitHub workflow `phase62-5-role-acceptance.yml` requires staging secrets; it never collects cash or changes a stay.

The write suite uses `npm run test:e2e:staging:write` and **must only run** against a disposable isolated database with its explicit staging host and database acknowledgement gates. Do not run write acceptance against the production hotel.

## Completion rule

**Do not declare Phase 62.5 complete** until:
- SQLite, PostgreSQL, and MySQL backend CI pass for the current commit.
- Frontend build/unit CI passes.
- The read-only staging role suite has actually run successfully, with no silently skipped required roles.
- The isolated staging write sequence passes the synthetic arrival, payment, turnover and day-close checks (where configured); a human reviewer records unautomated outcomes.
- Zero critical/high defects remain unresolved; any unresolved lower-severity issues have an owner, reproduction steps, and release decision.

**Current limitations:** production Railway frontend build success is not proof of financial correctness; read-only Playwright tests intentionally cannot verify a payment or physical room observation; a full, approved staging write run has not yet been demonstrated.
