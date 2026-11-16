# Room inventory timeline — Mock milestone

The Room Inventory page now has **Timeline** and **Grid** modes. Timeline lists physical rooms on rows and property-local dates on columns; it is **not a sellable inventory calendar**.

## Display semantics

- Date windows use `[from,to)` and the room-night cells exclude checkout.
- 7- and 14-night ranges start on Monday, calculated using hotel-local dates (initially Asia/Manila).
- Assigned reservations are shown on the matching physical-room row.
- Unassigned room-type reservations are shown **separately**, never silently assigned.
- A maintenance block is a separate dated record. A room's current maintenance/housekeeping condition is shown in the row label but must not be extrapolated to every future date.
- When assigned reservations overlap other assigned bookings or maintenance blocks, highlight **Review overlap**. This is indicative mock UI, not an enforcement mechanism.
- Empty nights say **No assignment** rather than Available. Lack of a physical assignment is not evidence of saleable inventory.
- No drag/drop, inventory modification, room assignment, or real reservation creation.

## Proposed Laravel API

`GET /api/v1/rooms/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:
```json
{
  "data": {
    "rooms": [
      {
        "id": "r201",
        "hotelId": "hotel-demo-001",
        "number": "201",
        "floor": 2,
        "roomTypeId": "standard",
        "roomTypeName": "Standard",
        "occupancyStatus": "vacant",
        "housekeepingStatus": "clean",
        "maintenanceStatus": "available",
        "maxOccupancy": 2
      }
    ],
    "blocks": [
      {
        "id": "block-res7",
        "kind": "reservation",
        "roomId": "r201",
        "from": "2026-11-16",
        "to": "2026-11-18",
        "reservationId": "res7",
        "reference": "FOH-1007",
        "guestName": "Paolo Garcia",
        "status": "confirmed"
      },
      {
        "id": "maintenance-r303",
        "kind": "maintenance",
        "roomId": "r303",
        "from": "2026-11-16",
        "to": "2026-11-25",
        "reason": "Example scheduled repairs"
      }
    ],
    "unassignedReservations": []
  },
  "meta": {
    "from": "2026-11-16",
    "to": "2026-11-23",
    "hotelId": "hotel-demo-001"
  }
}
```

The backend should return all physical rooms in scope and only dated blocks overlapping the requested range. Reservation and maintenance blocks represent intervals with an exclusive `to`. Only active reservation statuses appear as blocks; pending bookings are displayed provisionally because the policy for inventory holds is not yet approved. Room type and room assignment decisions still require discovery.

The server must validate property scope, hotel date windows, authorization, and allowable durations. Monetary and booking invariants must remain server-side.

## Frontend code

- `src/api/types.ts`: `RoomTimelineResponse` and `TimelineBlock`
- `src/api/mock/dataSource.ts`: mock source
- `src/api/httpDataSource.ts`: future API transport
- `src/api/queries.ts`: `useRoomTimeline`
- `src/features/rooms/RoomTimeline.tsx`: timeline UI
- `src/features/rooms/timelineUtils.ts`: testable display logic

## Follow-on backend decisions

Confirm room-type vs physical-room booking, maintenance block policy, overbooking behavior, holds for pending reservations, and housekeeping readiness rules before implementing true availability or editable inventory.
