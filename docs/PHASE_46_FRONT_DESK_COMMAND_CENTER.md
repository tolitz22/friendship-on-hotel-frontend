# Phase 46 — Front Desk Command Center

## Implemented

The API-backed `/front-desk` page now provides:
- Date navigation with today, previous/next date and a calendar input.
- Hotel-scoped manifest counts for confirmed arrivals, due departures, and registered in-house stays. No data from another property is merged.
- A **page-scoped** count of confirmed arrivals without assigned physical rooms, explicitly labeled as limited to the currently loaded arrivals page.
- Search, queues, pagination, 30-second foreground refresh, and an explicit Refresh button.
- A contextual primary action per reservation:
  - Unassigned confirmed arrival: **Assign room**.
  - Assigned confirmed arrival: **Review check-in**.
  - Checked-in departure: **Review checkout**.
  - In-house stay: **View stay**.
- Each action deep-links to the existing hotel-scoped reservation detail. Where applicable, the guarded assignment or lifecycle section is highlighted and scrolled into view.
- No button silently assigns rooms, records check-in/checkout, issues keys or takes payments. Current Laravel permissions, business-date rules, inventory checks, readiness policy, and confirmation acknowledgments remain authoritative.

## Manual acceptance checklist

1. In a dedicated staging environment, open `/front-desk` and verify the three queue totals match Laravel's `/front-desk/manifest` for the chosen hotel and date.
2. Create a synthetic confirmed arrival **without** a physical room. Verify **Assign room** appears; click it and verify the booking's room-assignment section is highlighted, with no write performed yet.
3. Assign a room through the existing guarded workflow, return to Front Desk, and verify **Review check-in** appears after refresh. Check-in is still subject to identity, readiness and Laravel business rules.
4. Use a synthetic checked-in reservation with departure due today. The departure queue should show **Review checkout** and open the guarded lifecycle section; the employee must still acknowledge and confirm.
5. Verify **In-house** rows show **View stay** rather than offering an incorrect check-in action.
6. Verify date navigation, search limited to the current page, pagination, and mobile layout.
7. Confirm the unassigned metric says “Arrivals on loaded page only”; it is not a hotel-wide count. None of these counts attest to physical occupancy or room cleanliness.
8. Run `npm run build` and `npm test` and inspect Railway deployment. Use only disposable synthetic data for write-based acceptance.

## Follow-up (not part of Phase 46)

A hotel-wide “rooms requiring attention” metric would require a separate authoritative readiness/housekeeping aggregation. The current manifest explicitly does **not** determine housekeeping readiness, so Phase 46 avoids manufacturing that status.
