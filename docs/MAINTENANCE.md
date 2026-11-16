# Maintenance Management — mock-only frontend milestone

The Maintenance page provides a read-only and locally simulated maintenance work-order interface.

## Features
- Summary cards for active orders, urgent/high priority, work orders flagged as room impacting, and resolved/closed history
- Search, priority filter, and active / all / specific status filtering
- Work-order cards with room, technician, priority, sample report date, and room-impact warnings
- Details drawer showing current room's occupancy, housekeeping and maintenance conditions independently
- Preview-only technician reassignment, work-order status, and local handover notes
- Existing sample history shown in chronological source order (not fabricated from preview edits)
- Reset preview to discard local draft changes
- Responsive light/dark theme

In mock mode drafts only change local component state, not mock fixtures or any other screen. In API mode editing is disabled. Completing a work order **never** marks the room available or removes it from an out-of-order block.

## Proposed API response

`GET /api/v1/maintenance/board`

Returns:
```json
{
  "data": {
    "workOrders": [
      {
        "id":"wo-001","hotelId":"hotel-demo-001","roomId":"r303","roomNumber":"303",
        "title":"Air-conditioning inspection","description":"Sample report",
        "priority":"high","status":"in_progress","assignedTo":"Alex Rivera",
        "reportedAt":"2026-11-16T08:30:00+08:00","resolvedAt":null,
        "affectsRoom":true,
        "history":[{"id":"h1","at":"2026-11-16T08:30:00+08:00","message":"Sample issue reported"}]
      }
    ],
    "rooms": [],
    "technicians":[{"id":"tech-a","name":"Alex Rivera"}]
  },
  "meta":{"hotelId":"hotel-demo-001","isPreview":true}
}
```

The frontend expects the same `Room` type as room inventory for `rooms`. This proposed endpoint is NOT yet implemented by Laravel.

## Domain safeguards
- Work order lifecycle `open | in_progress | resolved | closed` is distinct from the physical room's `maintenanceStatus`.
- `affectsRoom` is a **review flag**, not a direct command to set `out_of_order`.
- Room blocks are separately dated inventory entities. Do not automatically release blocked nights from a resolved work order.
- No automatic check-in eligibility changes, rate adjustments, guest notification, audit creation, or booking moves.
- Backend must define who can assign technicians, change priority/status, impose/release blocks, sign off safety inspections, and override conflicts, including property scope, permissions, audit history, and concurrent edits.

## Source layout
- `src/api/types.ts`: maintenance response and work-order types
- `src/api/queries.ts`: `useMaintenanceBoard()`
- `src/api/mock/maintenanceFixtures.ts`: fictional sample work orders and technicians
- `src/api/mock/dataSource.ts`: mock API response
- `src/api/httpDataSource.ts`: HTTP GET adapter
- `src/features/maintenance/workOrders.ts`: pure preview helpers
- `src/features/maintenance/workOrders.test.ts`: regression tests
- `src/pages/Maintenance.tsx`: responsive work-order dashboard

No production mutations should be enabled before the Laravel business rules and tests are complete.
