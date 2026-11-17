# Phase 44–45: front desk booking workspace

## Phase 44 — Complete calendar-to-reservation workflow

- Room Inventory Calendar supports week/month display and read-only hotel-scoped booking/maintenance data.
- Click a future empty room/day cell, choose a departure date of up to 31 nights, and follow the **Create reservation** action. On desktop, dragging across consecutive dates in the same room also selects a range.
- Selected room, its validated room type, check-in and checkout date are carried to the Reservations form. User-controlled URL hints are verified against the selected hotel's current room catalogue.
- Select an existing guest **or create a new guest inline**, using the existing Laravel hotel-scoped admin guest endpoint. The saved profile becomes the selected guest without leaving the form.
- Choose an active rate, check server availability and subtotal, then confirm the booking. An idempotency key is preserved for uncertain booking outcomes.
- Post-creation, use the existing admin room-assignment action. The preferred physical room is preselected only if it still exists in the hotel and matches the booked room type; Laravel performs the authoritative overlap/block check. No room assignment is implied by a click or quote.

## Phase 45 — Operational calendar and reservation shortcuts

- Calendar provides a page-scoped operational snapshot: displayed rooms, assigned reservations, in-house records, active maintenance blocks and a hotel-wide unassigned-reservations alert for the date period. Counts are not occupancy certification.
- The calendar refreshes every 30 seconds while the page is active, and its cached data is invalidated after booking creation, physical room assignment, and check-in/out. A manual Refresh action is always available.
- Occupied-cell popup shows the guest's name (from a hotel-scoped Laravel JOIN, when present), booking reference, stay duration, arrival/departure dates and booking status.
- Occupied-cell popup shows a provisional financial-evidence snapshot (staff-confirmed and pending payment evidence) when a priced folio exists, explicitly not proof of settlement. It links to **Manage booking** and **View folio**. The live Billing page accepts a validated reservation-ID link and loads the hotel-scoped folio automatically; no copy/paste required.
- A new GitHub Actions quality workflow runs `npm run build` and `npm test` on pushes and PRs. The opt-in protected Playwright write suite now includes a synthetic calendar-to-inline-guest booking test.

## Acceptance checks

1. Sign in as a *synthetic staging* hotel administrator. Use a clean staging database with no real guest or payment data.
2. From `/room-calendar`, choose a future unassigned physical room, select two or more nights, and verify the corresponding dates and room type appear on `/reservations`.
3. Create a synthetic guest inside the booking form and confirm the selection is retained without leaving the form.
4. Check availability and pricing, then create a reservation. Verify the returned reference and idempotent retry behavior.
5. Open the reservation, verify the preferred room in the assignment selector, and complete assignment only after inspecting room readiness and applicable blocks. Confirm the calendar displays the assignment after Refresh.
6. Click the occupied cell; verify guest/reference, booking dates, booking link, and live folio link.
7. Test booking collisions and active maintenance blocks. Confirm Laravel refuses unsafe assignments. An empty calendar square is never proof of physical vacancy or room readiness.
8. Test on mobile, Escape, backdrop close, focus return, and keyboard-operable checkout date entry.
9. Run unit tests and TypeScript build via the GitHub quality workflow and the protected Phase 43 staging-write acceptance workflow. Both workflows must pass on a disposable staging database before a production-readiness claim.

## Known limitations

- The calendar is an operational **read-only projection**, not an authoritative room-readiness or physical occupancy sensor.
- It does not automatically reserve or assign a particular physical room. Pricing previews exclude final taxes/fees and aren't evidence of payment settlement.
- Dragging is a desktop convenience; mobile and keyboard users can choose checkout via the popup's accessible date input.
- Backend inventory capacity is room-type based; final physical assignment is a separate guarded operation.
- Live folio amounts reflect recorded financial evidence, not gateway verification or final legal settlement.
- A frontend-only interface cannot prevent employee collusion or off-system stays. Those require independent controls (keycard logs, CCTV, housekeeping inspection, night audits).

## Deployment

Deploy the matching backend and frontend `main` branches. No new schema migration is needed for these changes.
Existing `VITE_DATA_SOURCE=api`, `VITE_AUTH_MODE=token`, and `VITE_API_URL` settings remain in effect.

Never embed staff credentials in GitHub source, issue bodies or deployment logs.
