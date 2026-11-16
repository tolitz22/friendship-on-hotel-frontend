# Hotel Settings & Configuration — Mock milestone

Settings is a **prototype configuration workspace**, not a production administration feature. It reads through the same typed `HotelDataSource` abstraction as the rest of the frontend.

## Available sections

- **Property:** Name, sample address, contact email, contact phone. Validation uses Zod. In mock mode changes are temporary and Validate preview confirms only that the fields pass validation; nothing is saved.
- **Rooms & floors:** Read-only room type names, physical room counts, max occupancy and illustrative nightly rates; sample floors derived from the same `rooms` fixtures used by Room Inventory.
- **Operations:** Mock check-in and check-out display times. The initial timezone `Asia/Manila` and currency `PHP` are locked as examples. No other hotel workflow automatically takes values from this mock configuration.
- **Staff roles:** Display-only role names, fictional staff counts, permission label examples. These are **not** Laravel policies or server authentication.

The original logo is not loaded into the repo yet; the settings page does not alter branding files. No real address or contact information is claimed.

## Typed response

Proposed endpoint: `GET /api/v1/settings/overview`.

```json
{
  "data": {
    "property": {
      "id": "hotel-demo-001",
      "name": "Friendship On Hotel",
      "address": "Sample property address — replace with verified information",
      "contactEmail": "hello@example.test",
      "contactPhone": "",
      "timeZone": "Asia/Manila",
      "currency": "PHP",
      "checkInTime": "14:00",
      "checkOutTime": "12:00"
    },
    "roomTypes": [{"id":"standard","name":"Standard","maxOccupancy":2,"roomCount":3,"sampleRate":{"amountMinor":250000,"currency":"PHP"}}],
    "floors": [{"number":2,"roomCount":3}],
    "roles": [{"id":"front_desk","name":"Front Desk","description":"Example reception workflow role","permissionLabels":["Reservations","Guest records"],"staffCount":3}]
  },
  "meta": {"hotelId":"hotel-demo-001","isPreview":true}
}
```

This is a **draft contract**. The Laravel endpoint does not exist yet. API mode displays a read-only configuration screen; no update endpoints or mutations are enabled.

## Implementation files

- `src/api/types.ts`: `PropertySettings`, `RoomTypeSettings`, `FloorSettings`, `StaffRolePreview`, `HotelSettingsResponse`
- `src/api/mock/settingsFixtures.ts`: sample details and room-derived counts
- `src/api/queries.ts`: `useHotelSettings()`
- `src/api/mock/dataSource.ts`: mock adapter
- `src/api/httpDataSource.ts`: HTTP GET adapter
- `src/features/settings/settingsValidation.ts`: sample form validation
- `src/features/settings/settingsValidation.test.ts`: regression tests
- `src/pages/Settings.tsx`: navigation and configuration UI

## Pending backend requirements

Confirm official property details and physical floors/room types. Determine whether the system is single-property or multi-property. Design scope-aware RBAC, invite/deactivation flows, audited configuration changes, room-type deletion rules for existing bookings, currency/timezone invariants and check-in/out exceptions. Neither front-desk nor reservation policies should be inferred from these sample settings.

After this milestone, prioritize Laravel bootstrap, tests and domain requirements instead of expanding unconnected mock workflows.
