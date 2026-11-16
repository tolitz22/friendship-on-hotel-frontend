# Front Desk — mock operational workflow

The Front Desk module is a read-only operational preview backed by the shared `HotelDataSource` interface.

## Screens
- Operational date picker (hotel timezone initially Asia/Manila), previous/next/today shortcuts
- Arrival queue: confirmed and pending reservations with check-in on the selected date
- Departure queue: checked-in reservations with checkout on the selected date
- In-house queue: checked-in reservations overlapping the selected operational date
- Summary counters and search
- Room number/type, housekeeping and maintenance warnings
- Modal check-in and check-out **walkthrough** with checklist and demo completion state

The arrival and departure tabs use a date-specific *demonstration* classification, not a finalized hotel eligibility rule. Actual early/late arrival, no-show, payment, overbooking, guest verification, room-ready criteria and night-audit cutoffs are not specified yet.

## Proposed endpoint

`GET /api/v1/front-desk/board?date=YYYY-MM-DD`

Response envelope:
```json
{
  "data": {
    "arrivals": [{
      "reservation": {
        "id": "res7", "reference": "FOH-1007", "hotelId": "hotel-demo-001",
        "primaryGuestId": "g4", "primaryGuestName": "Paolo Garcia",
        "roomTypeId": "standard", "roomTypeName": "Standard",
        "assignedRoomId": "r201", "assignedRoomNumber": "201",
        "checkIn": "2026-11-17", "checkOut": "2026-11-18",
        "status": "confirmed", "adults": 2, "children": 0,
        "total": {"amountMinor": 500000, "currency": "PHP"},
        "createdAt": "2026-11-14T11:00:00+08:00"
      },
      "room": {
        "id": "r201", "hotelId": "hotel-demo-001", "number": "201",
        "floor": 2, "roomTypeId": "standard", "roomTypeName": "Standard",
        "occupancyStatus": "vacant", "housekeepingStatus": "clean",
        "maintenanceStatus": "available", "maxOccupancy": 2
      },
      "readiness": "review_required",
      "alerts": []
    }],
    "departures": [],
    "inHouse": []
  },
  "meta": {
    "date": "2026-11-17",
    "hotelId": "hotel-demo-001",
    "timeZone": "Asia/Manila",
    "isPreview": true
  }
}
```

The fields above describe a **proposed API contract**, not an implemented endpoint. Production must scope by property and permissions. Laravel must determine eligibility, room readiness, folio status and transactionally apply state transitions.

## Explicit non-goals
- The completion button does **not** send a request or mutate reservations.
- It does not grant access, issue keys, charge deposits, settle folios or change housekeeping status.
- The UI checklist is **not an authorization/eligibility engine**.
- No real guest PII should be placed in mock fixtures.

## Implementation
- `src/api/types.ts`: `FrontDeskBoardResponse`, `FrontDeskEntry`
- `src/api/queries.ts`: `useFrontDeskBoard(date)`
- `src/api/mock/dataSource.ts`: mock queue adapter
- `src/api/httpDataSource.ts`: provisional read endpoint
- `src/pages/FrontDesk.tsx`: queue UI
- `src/features/front-desk/OperationPreview.tsx`: simulated checklist
- `src/features/front-desk/operations.ts`: pure warning and checklist helpers

Front desk stays strictly read-only in API mode until backend inventory, permission, folio, audit logging and transaction rules have been implemented and reviewed.
