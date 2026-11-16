# Reports & Analytics — Frontend Mock Milestone

Read-only reports built on typed `HotelDataSource.getReports({from,to})`. Current mock uses fictional fixture data; no real hotel financial/operational reporting is performed.

## Scope and meanings
- Date filter is **inclusive** on both ends, using hotel-local YYYY-MM-DD strings.
- Reservations by status: reservations whose **check-in date** is in the selected range, grouped by current status; not room-night occupancy.
- Booking value: total reservation value (minor PHP units) for selected arrivals except cancelled/no-show; **not recognized revenue or payments**.
- Arrivals by date: show only dates with fictional arrivals; zero days are not yet charted.
- Occupied/vacant/out-of-order room metrics: a **current mock snapshot** from the Room fixtures, as of 2026-11-17; unaffected by report date filter. This is NOT average occupancy over a period.
- Housekeeping task counts: a **current task-status snapshot**, not task completions for selected dates.
- Maintenance: orders **reported within the selected date range**, grouped by their current work-order status, not the status at that historical moment.
- Folio totals (charges, payments, balances): aggregate across ALL sample folios; **not filtered by date**, not revenue, not cash-flow. No tax, ADR, RevPAR, payment reconciliation or P&L claims.
- CSV export contains the report range, prominent fictional-sample disclaimer and selected summary breakdowns; no customer PII.

## Provisional Laravel response
`GET /api/v1/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

```json
{
 "data": {
  "reservationsByStatus":[{"status":"confirmed","count":1}],
  "arrivalsByDay":[{"date":"2026-11-17","count":1}],
  "totalArrivals":1,
  "bookingValueMinor":500000,
  "roomSnapshot":{"total":8,"occupied":3,"vacant":5,"outOfOrder":1},
  "housekeeping":{"total":4,"todo":2,"inProgress":1,"done":1},
  "maintenance":{"reported":2,"open":2,"inProgress":0,"resolved":0,"closed":0,"highPriority":1},
  "folios":{"count":3,"chargesMinor":3080000,"paymentsMinor":2020000,"balanceMinor":1060000}
 },
 "meta":{"hotelId":"hotel-demo-001","from":"2026-11-17","to":"2026-11-17","currency":"PHP","isIllustrative":true,"roomSnapshotAsOf":"2026-11-17","folioScope":"all_sample_records"}
}
```

Values above are illustrative contract examples and not guaranteed fixture results. Align types and metrics with authoritative Laravel reporting definitions before connecting API mode.

## File mapping
- `src/api/types.ts`: `ReportQuery`, `ReportMetrics`, `ReportResponse`
- `src/api/queries.ts`: `useReports()`
- `src/api/mock/dataSource.ts`: fixture-backed GET adapter
- `src/api/httpDataSource.ts`: future HTTP adapter
- `src/features/reports/reportMath.ts`: pure aggregation calculations
- `src/features/reports/reportMath.test.ts`: regression tests
- `src/pages/Reports.tsx`: charts, filters, CSV export

## Next backend requirements
Define property-scoped reporting date windows, accounting/timezone policies, room-night occupancy denominators, real ledger revenue recognition, refunds, deposits, taxes, cancellation handling, audit and authorization before showing production reports.
