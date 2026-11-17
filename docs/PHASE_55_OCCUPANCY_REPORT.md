# Phase 55 — Occupancy Coverage Dashboard

- New manager-only route: `/occupancy-coverage`. Report links are also shown inside the manager's `/occupancy-verification` workspace.
- Daily room coverage for a selected hotel-local inspection date: rooms, assigned inspections, missing inspections, observed inspections, pending reviews, flagged cases, verified cases and observation mismatch types.
- Read-only, server-filtered and paginated rows. No checkout, payment or registration changes.
- Historical inspection outcomes are read from the original Phase 53 observations. They are never silently rewritten when reservations change. The physical-room catalogue count is **current** even when the chosen date is historical.
- Managers can filter missing, assigned, needs review, mismatches/unknowns, flagged and verified records.
- Missing observations are NOT vacant rooms. Mismatches are NOT findings of fraud.

**Deferred hardware features:** `/keycard-access` has been removed from active React routes, staff navigation and booking detail shortcuts. The dormant source code and previous backend audit records are retained. No CCTV features appear in the active PMS navigation or route tree. The manager report works without keycards or cameras.

Validation:

```bash
npm ci
npm test
npm run build
```

Backend must be deployed first with `GET /api/v1/hotels/{hotel}/occupancy-coverage-report`; that endpoint is restricted to hotel administrators.

Phase 56 CCTV integration is deferred. Next recommended non-hardware milestone: **Phase 57 — Night Audit & Daily Revenue Reconciliation**.
