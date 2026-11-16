# Reservation calendar · design milestone

This is a **read-only reservation schedule**. It is **not** a sellable inventory / availability calendar.

- Day and week views, Monday-first week.
- All date strings use hotel-local `YYYY-MM-DD` values, advanced using UTC date arithmetic so display does not shift between browser time zones.
- Each calendar cell represents a **night**, and checkout is excluded: `checkIn <= night < checkOut`.
- Rows are grouped by **room type**, not physical room: this supports reservations with unassigned room IDs.
- Cards are repeated across occupied nights, but each references the same reservation ID.
- Status and room-type filters; name/reference/assigned-room search.
- Read-only details panel with date, allocation, status, occupancy and example total.
- Cancelled/checked-out/no-show records are separated from active-night chips.
- No capacity counts, availability promises, overbooking decisions or room assignment actions.

## API contract (proposed)

`GET /api/v1/reservations/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`

`from` is inclusive, `to` is exclusive. Response:
```json
{
  "data": [
    {
      "id": "res1", "reference": "FOH-1001",
      "hotelId": "hotel-demo-001",
      "primaryGuestId": "g1", "primaryGuestName": "Maria Santos",
      "roomTypeId": "deluxe", "roomTypeName": "Deluxe",
      "assignedRoomId": "r301", "assignedRoomNumber": "301",
      "checkIn": "2026-12-10", "checkOut": "2026-12-12",
      "status": "confirmed", "adults": 2, "children": 0,
      "total": {"amountMinor":840000,"currency":"PHP"},
      "createdAt": "2026-11-10T10:00:00+08:00"
    }
  ],
  "meta": {
    "from": "2026-12-07", "to": "2026-12-14",
    "roomTypes": [{"id": "deluxe", "name": "Deluxe"}]
  }
}
```

Backend should return every reservation satisfying `reservation.checkIn < to && reservation.checkOut > from`, including cancelled/no-show records for audit display if the access policy permits. Display filters are applied in the browser to the returned period's full set. Backend must enforce a safe bounded date window and authorization scope.

**Remaining decision:** inventory is not assumed sold per physical room. Do not derive availability from these displayed bookings alone.
