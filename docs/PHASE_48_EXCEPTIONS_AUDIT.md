# Phase 48 — Exceptions & Audit Review

## Scope

A manager-only, read-only exception dashboard at `/operational-exceptions` powered by:
`GET /api/v1/hotels/{hotel}/operational-exceptions?days=7`.

The endpoint is behind `auth:sanctum`, `active.user`, `hotel.member`, **and `hotel.admin`**. It only reads the selected hotel's own records. No database migration or package dependency is needed.

### Live signals

- **Upcoming confirmed arrival with no assigned room:** check-in dates from the hotel-local today through the end-exclusive 1, 7 or 14 day window.
- **Checked-in reservation with no assigned room:** operational inconsistency requiring record reconciliation.
- **Two active reservations overlapping on one assigned physical room:** half-open stay comparison; checkout dates are exclusive. This does not itself establish unauthorized physical occupancy.
- **Payment evidence pending review:** all still-pending records, not proven fraud or actual bank settlement.

Ordinary reservation change history is displayed separately as **neutral audit activity**, with recorded actor IDs. It is not assigned an accusation or risk score.

### Guardrails

- Source queries are hotel-scoped and bounded to 500 records. If a source exceeds the limit the endpoint returns HTTP 422 instead of claiming partial results are hotel-wide totals.
- No automated fraud score, staff accusation, inventory write or payment action.
- No claim to be connected to physical room entry, keycard access, independent housekeeping occupancy, or CCTV: all three integrations are explicitly unavailable until real external logs exist.
- The frontend validates that the response matches the selected hotel and that summary totals match the returned exception entries.
- The frontend refreshes each minute while active; the manual Refresh action remains available.
- The UI provides direct links to guarded reservation, room rack and folio workflows; it cannot silently reverse charges, book rooms or change audit history.

## Staging acceptance

1. Use **an isolated synthetic hotel** and confirm administrator access succeeds while ordinary staff receive HTTP 403, unauthenticated users get HTTP 401, and another hotel's records stay inaccessible.
2. Create a synthetic upcoming confirmed unassigned reservation; verify **Needs assignment** rises by one and its detail link opens the correct booking.
3. Use an isolated database fixture to insert two overlapping assigned stays; verify one **Urgent review** record and correct references.
4. Record synthetic payment evidence and leave it pending review; verify **Payment evidence** appears and its folio link opens the selected hotel's ledger.
5. Confirm regular reservation event history appears only in the neutral activity section, with correct actor and timestamp.
6. Change hotel. Verify filters, reports and links cannot reveal records from the previous hotel.
7. Verify 1, 7 and 14 day arrival windows and that pending payments/in-house inconsistencies are not represented as date-windowed when they are not.
8. Verify empty states do not claim there are no off-system stays, and keycard/CCTV/independent occupancy are marked not integrated.
9. Run backend Pest tests plus frontend `npm ci`, `npm run build`, `npm test`, and browser tests in isolated staging before production acceptance.

**Note:** The frontend uses the committed `package-lock.json`; it does not regenerate or modify it.
