# Housekeeping board — mock milestone

The frontend Housekeeping module has a Kanban-style board with **To do**, **In progress**, and **Completed** task columns, floor/staff/search filters, summary counters, room-condition warnings, maintenance alerts, and a task-details drawer.

## Non-persistent simulation

In `VITE_DATA_SOURCE=mock`, team assignments and task progress updates are maintained in local React component state, layered over immutable mock API fixtures. They disappear when the page reloads or when staff clicks **Reset preview**. Preview notes are local only.

In `VITE_DATA_SOURCE=api`, the board is **read-only**; it shows data from the backend but does not submit updates, assign teams, or mark rooms clean.

The status of a housekeeping **task** is separate from a room's `housekeepingStatus`, `occupancyStatus`, and `maintenanceStatus`. Finishing a task does not prove that a room is ready or available for a guest.

## API draft

`GET /api/v1/housekeeping/board`

```json
{
 "data": {
  "tasks": [
   {"id":"hk1","hotelId":"hotel-demo-001","roomId":"r203","roomNumber":"203","type":"checkout_clean","status":"todo","assignedTo":"Team A","dueAt":null}
  ],
  "rooms": [
   {"id":"r203","hotelId":"hotel-demo-001","number":"203","floor":2,"roomTypeId":"standard","roomTypeName":"Standard","occupancyStatus":"vacant","housekeepingStatus":"dirty","maintenanceStatus":"available","maxOccupancy":2}
  ],
  "staff": [{"id":"team-a","name":"Team A"}]
 },
 "meta": {"hotelId":"hotel-demo-001","isPreview":true}
}
```

This is a **provisional** response envelope, not a functioning Laravel endpoint. There is no backend mutation contract yet. Server-side development must finalize assignment policy, statuses, inspection sign-off, transitions, audit logs, concurrency, notification requirements, and RBAC before adding mutations.

## Files

- `src/api/types.ts`: `HousekeepingBoardResponse`
- `src/api/queries.ts`: `useHousekeepingBoard()`
- `src/api/mock/dataSource.ts`: mock board response
- `src/api/httpDataSource.ts`: future `GET /housekeeping/board`
- `src/features/housekeeping/board.ts`: pure formatting/transition helper functions
- `src/features/housekeeping/board.test.ts`: unit tests
- `src/pages/Housekeeping.tsx`: task board and temporary preview controls

Do not add drag-and-drop live mutations, automated availability updates, or real staff identity data without backend approval.
