# Phase 62.5 — Hotel PMS operational acceptance gate

**Status: IN PROGRESS.** Passing deployment or TypeScript builds alone is not acceptance.
All writing tests **must** run against an explicitly provisioned, disposable staging hotel and isolated database. Never use real guests, real funds, or the production database. No automated workflow may silently enable the final settlement or tax-posting feature flags.

## Gate A — automated tests (required, must pass on main)

| Critical hotel scenario | Expected system behavior | Supporting automated checks |
|---|---|---|
| Guest arrives | Guest and reservation saved; room assignment is consistent; check-in requires correct readiness and dates; duplicate booking and double check-in rejected | `Phase43RealWorkflowAcceptanceTest`, `DirectReservationWorkflowPhase39Test`, `RoomReadinessEnforcementPhase36Test`, `ReservationScenarioTest`, `RoomConflictDiagnosticsTest` |
| Cash guest payment | Open cashier shift belongs to collector; payment linked to correct folio; idempotent receipt; review separate from collection; counted change never booked as receipt; variance is preserved | `CashierShiftPhase52Test`, `Phase43RealWorkflowAcceptanceTest`, frontend `billing.test.ts`, `e2e/staging-write/guest-to-checkout.pw.ts` (isolated, manual-only) |
| Checkout and turnover | Check-out creates one cleaning task; cleaning is recorded; inspection and independent readiness approval do not bypass active blockers; closed rooms cannot be assigned | `CheckoutTurnoverHandoffPhase40Test`, `RoomReadinessPhase35Test`, `RoomInventoryCheckoutCleaningTest`, `RoomReadinessEnforcementPhase36Test` |
| Physical occupancy discrepancy | Assigned housekeeping observes room; independent manager reviews snapshot mismatch; flagged follow-up has owner, findings and independent closure; original evidence retained | `OccupancyVerificationPhase53Test`, `OccupancyCoverageReportPhase55Test`, frontend `occupancyCoverageReport.test.ts`, read-only occupancy staging tests |
| Business-date and night audit | Verified accounting sources required; close only after review and journal balance; idempotent posting; historical periods locked; earned revenue not double counted | `FinancialBusinessDayIntegrationTest`, `NightAuditFinancialReportTest`, `NightAuditReviewPhase58Test`, `NightAuditPreviewPhase57Test`, `FinancialRealDatabaseConcurrencyTest` |
| Hotel isolation and staff restrictions | Cross-hotel reads/writes rejected; roles and permissions enforced; audit names/timestamps preserved; two-person approval cannot self-approve | `HotelIsolationTest`, `FineGrainedPermissionsPhase50Test`, `HotelStaffPermissionsTest`, `ManagerApprovalPhase51Test`, `FinanceFolioAccessRouteTest` |

**Automated gate:** `.github/workflows/backend.yml` runs full Laravel suite against SQLite, PostgreSQL 16 and MySQL 8.4; frontend quality workflows run TypeScript build and Vitest. All must be green on the **same current main revision** in each repository. Running individual test files is not equivalent to a clean full-suite pass.

## Gate B — read-only browser inspection

Manually run the `Staging staff read-only smoke` GitHub Actions workflow with **dedicated staging accounts**, configured as GitHub `staging` environment secrets:
- Manager: `PMS_STAGING_ADMIN_EMAIL`, `PMS_STAGING_ADMIN_PASSWORD`
- Front desk: `PMS_STAGING_FRONT_DESK_EMAIL`, `PMS_STAGING_FRONT_DESK_PASSWORD`
- Housekeeping: `PMS_STAGING_HOUSEKEEPING_EMAIL`, `PMS_STAGING_HOUSEKEEPING_PASSWORD`
- Shared staging URL: `PMS_STAGING_URL`; legacy dedicated account `PMS_STAGING_EMAIL` and `PMS_STAGING_PASSWORD` if required by the existing smoke.

Verify desktop and mobile: clear role-specific next actions, readable dates, employee audit names and actual changes, no horizontal overflow, meaningful loading/error/empty states, and no payment/room/status mutations from smoke tests. Never capture screenshots, videos or traces containing hotel personal data.

## Gate C — controlled write acceptance (separate manual approval)

Only a dedicated disposable hotel with isolated DB and synthetic data may run the **staging-write** workflow. Existing config requires exact HTTPS host allowlists, an isolated-DB acknowledgement, and a write-enable flag.

1. **Arrival:** synthetic guest → reservation → ready-room assignment → check-in. Assert second conflicting assignment and duplicate requests fail.
2. **Cashier:** fresh staff-owned shift → net cash receipt → repeated same idempotency key → receipt remains pending review; separate admin confirms it. Test counting/reconciliation and 0 / positive / negative variances using separate staff identities. Cash handed over minus change must equal recorded payment amount.
3. **Turnover:** departure-due synthetic booking → checkout → one checkout-clean task → cleaning → independent inspection approval; check actual hold/release behavior, including rejected inspection and blocked maintenance.
4. **Occupancy:** independent housekeeper records mismatch → manager flags → opens investigation → owner records evidence reference → **different** manager closes. An unknown observation cannot be marked verified; case closure must never modify booking, payment, or room assignment automatically.
5. **Night audit:** balanced journals and independent review → day close → next business date. Inject malformed or unbalanced entry and assert **no partial close**, no duplicate revenue, and no reopening of history.

Do not run this gate against live Railway services **unless the backend and frontend use an independently verified disposable database and synthetic credentials**. A Railway hostname by itself does not satisfy that condition.

## Ship / no-ship criteria

- **No ship** if any main-branch CI quality job fails, any account isolation test fails, a cash receipt duplicates, room inventory double-books, unauthorized employee approves their own evidence, or an unbalanced day can close.
- **No ship** if staging writes or migrations have not been confirmed on the target DB engine, or final settlement/tax posting has not received independent finance sign-off.
- **Ship only when** all critical scenario steps above have a recorded PASS, exact repo commits, test run links, and named reviewer; zero unresolved P0/P1 defects.
- On failure, capture **redacted** request route, timestamp, correlation ID, expected/actual behavior and reproduction steps. Do not paste tokens, guest identities, passwords, payment card details, or live transaction references into issues.

## Current evidence
This document records **required acceptance**, not a claim that all scenarios have been run. The previous Phase 43 staging-write suite had a stale direct-cash mutation; Phase 62.5 updates it to the mandatory open-shift cash receipt API with pending-review assertions. Browser mutation tests remain manual and strictly allowlisted.

## Phase 62.6 — Manager Action Center (implementation following QA preparation)
The existing read-only Operational Exceptions API now includes room-impacting maintenance, submitted room inspections, pending manager occupancy reviews, open/unassigned occupancy investigations, and submitted cashier shifts alongside reservation overlaps, missing assignments and unreviewed payment evidence. These come from hotel-scoped database records, with names, readable dates and direct links to the operational module. The UI is a **work queue**, not a fraud finding, work-order resolution engine, or live reconciliation service.

- The manager dashboard links to the relevant existing screens; completing or investigating any item must happen in the original module with its own permission checks.
- Only submitted cashier shifts appear in reconciliation items; an open shift is normal daily work, not an exception.
- Flagged occupancy checks with independently **closed** investigations are excluded from open follow-up. Their original observation remains in occupancy history.
- Room readiness inspection submissions await an independent manager; editing an older inspection or bypassing blockers is not performed here.
- This list is a **snapshot**, not a claim that every future or off-system issue has been detected. Source limits reject oversized datasets rather than displaying knowingly incomplete totals.
- The tests `OperationalExceptionsTest.php`, `operationalExceptions.test.ts`, and `manager-action-center-readonly.pw.ts` cover signals, schema/count consistency, filtering and desktop/mobile read-only navigation. Browser smoke is not a substitute for a real, isolated full-workflow acceptance test.

**Acceptance remains IN PROGRESS** until backend SQLite/MySQL/PostgreSQL test gates, frontend build and unit tests, multi-role read-only browser QA, and separately authorized isolated synthetic write runs are recorded as passing on current commits. Successful Railway deploys alone are not proof. Phase 63 and final settlement/tax activation remain gated.
