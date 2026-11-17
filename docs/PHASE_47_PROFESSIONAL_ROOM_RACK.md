# Phase 47 — Professional Room Rack

## Delivered

The live hotel-scoped `/room-calendar` now uses a room-rack timeline instead of repeating a booking reference in every occupied date cell.

- **Week / month views:** same Laravel calendar API, 7 or up to 31 room nights.
- **Continuous reservation bars:** each assigned booking spans its occupied nights, with departure date excluded. Starts/ends outside the displayed period are clipped and marked with edge arrows.
- **Status colors:** reserved, in house, maintenance blocked; overlapping bookings/blocks appear in separate lanes with warnings.
- **Sticky room numbers and date header:** horizontal/vertical scrolling keeps room labels and the date context visible.
- **Details drawer:** click a reservation bar for guest, reference, stay dates, status, provisional folio evidence and navigation to the guarded reservation/folio pages; close with Escape, backdrop click, or Close.
- **Empty dates:** click to view availability guidance or select a future stay. Dragging across free dates is retained on desktop, as is the departure-date picker on mobile/keyboard.
- **Filtered and paginated:** room type, floor, room search, 30-second foreground refresh, manual refresh; existing room-page counts and hotel-wide unassigned count remain explicitly scoped.
- **No silent writes:** clicking a bar does not move or change a reservation.

## Why room moves are not implemented as drag and drop

A visual reassignment alone can overbook a room or bypass hotel permissions, housekeeping readiness, maintenance blocks, and audit history. This release retains the existing guarded assignment workflow. A later milestone can add drag-to-reassign only after a Laravel endpoint performs all checks transactionally and records the actor.

## Acceptance verification

1. In a disposable staging hotel, create a 3-night assigned reservation. The week rack should display one continuous bar spanning 3 dates; the checkout date itself must not be covered.
2. Switch to Month. Inspect a reservation crossing the beginning/end of the month; it should be clipped with arrow hints, not repeated or extended across checkout.
3. Click the bar. Confirm the drawer shows the correct guest, reference and full stay, plus **Manage booking** and **View folio** links.
4. Make two synthetic overlapping records or an overlapping maintenance block in a test fixture. Verify both render in separate lanes and a warning appears; do not create conflicting operational bookings.
5. Click an empty future date and start a booking; verify the selected room and arrival date are passed to the reservation form, and Laravel still revalidates availability before saving.
6. Use keyboard-only navigation and Escape; test the responsive drawer on mobile.
7. Run `npm run build` and `npm test`. Protected browser tests should run only against a separately isolated staging database.

## Data limitations

- This is a **read-only occupancy projection** from assigned reservation records and active maintenance blocks.
- It is **not** proof that a room is clean, safe, physically occupied, or sellable.
- The ledger preview is payment evidence, **not** verified financial settlement.
- Unassigned reservations are counted separately because they cannot be plotted on a physical room.
