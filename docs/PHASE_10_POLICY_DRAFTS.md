# Phase 10 — Versioned reservation policy drafts

## Purpose

Phase 10 makes the previously unresolved reservation rules **explicit, editable hotel-specific drafts**. It does **not** activate a booking engine, infer an inventory-selling model, reserve room nights or calculate availability.

## Current behavior

In the React/Vite frontend with `VITE_DATA_SOURCE=api`, the sidebar contains **Booking policies**. Staff with active hotel membership can inspect the current selections; active hotel admins with `hotel:write` ability can save decisions.

Each hotel begins at revision **0**, with eight undecided values (`null`). There are no predefined policy choices, so a new hotel cannot inadvertently use invented booking rules.

Fields and options:

| Field | Choices |
| --- | --- |
| `sellableUnit` | physical_room / room_type / hybrid |
| `assignmentTiming` | at_booking / before_arrival / at_check_in |
| `inventoryConsumption` | confirmed_only / pending_and_confirmed / confirmed_and_checked_in / pending_confirmed_checked_in |
| `holdPolicy` | no_pending_holds / timed_pending_holds |
| `maintenanceBlocks` | block_out_of_service / block_out_of_service_and_manual |
| `overbooking` | prohibited / authorized_override |
| `cancellationPolicy` | manual_review / cutoff_based |
| `ratePolicy` | manual_quote_review / published_rate_plans |

These are preliminary *design choices*, not a full operational policy. For example, selecting timed pending holds does not define the hold's duration; choosing cutoff-based cancellations does not define the cutoff or refund fees. Some combinations require further compatibility review (such as check-in assignment when selling physical rooms).

**A complete draft is not an approved policy**: the API always returns `status: "draft"` and `effectiveForBookings: false`. No approval, activation, booking create, availability allocation or inventory-hold endpoint has been added.

## APIs

```http
GET /api/v1/hotels/{hotel}/reservation-policy-draft
PATCH /api/v1/hotels/{hotel}/reservation-policy-draft
GET /api/v1/hotels/{hotel}/reservation-policy-draft/history
```

Reading a draft requires an active hotel member and `hotel:read` token. Editing and history require an active hotel administrator with both `hotel:read` and `hotel:write` abilities. All routes remain hotel-scoped.

Example partial save:

```json
{
  "expectedRevision": 0,
  "decisions": {
    "sellableUnit": "hybrid",
    "overbooking": "prohibited"
  }
}
```

The response includes the new numbered revision, complete merged decisions, missing-field checklist and constant inactive draft status.

Saving checks `expectedRevision` while locking the selected hotel row inside a database transaction. A stale revision returns HTTP **409 Conflict**, without overwriting newer decisions. The UI provides **Reload saved draft** to resolve it. A no-op save creates no new revision.

Each changed draft snapshot is persisted with a revision number, editor user ID and timestamp in `reservation_policy_draft_revisions`. The latest snapshot is in `reservation_policy_drafts`. These use ordinary foreign keys, JSON, and transaction locks compatible with **MySQL 8.4/InnoDB and PostgreSQL 16+**.

## Verification

**Backend:**

```powershell
git pull origin main
php artisan migrate
php artisan test
php artisan route:list --path=api
```

**Frontend:**

```powershell
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

The **new database migration is required**. It creates `reservation_policy_drafts` and `reservation_policy_draft_revisions`.

The backend tests cover unselected defaults, partial updates, revision conflicts, idempotent no-op, unauthorized writes/history, cross-property isolation, invalid choices, and no booking API after full completion. Frontend tests cover bearer authentication, selected-hotel paths, 409 responses and history requests.

Source was committed, but a live migration, passing CI and browser verification are required before production use.

## What remains unresolved before Phase 11 booking transactions

The operator must confirm the chosen options and fill in the operational details:

- Exact status transitions, pending/confirmed/check-in/no-show semantics.
- Time limit and expiration behavior for held inventory.
- Maintenance and manually blocked room-night representation.
- Maximum overbooking quantity and override authorization, if any.
- Cancellation/refund windows, amendments and date changes.
- Rate-plan calculations, taxes and deposits.
- Hotel-local cutoff times and night-audit behavior.
- Audit log and idempotency policy for all booking commands.

The next milestone should validate approved, fully specified policies **before** implementing double-booking-safe reservations under both MySQL and PostgreSQL.

Previous mock reservation pages and all existing live modules remain intact; the diagnostic report remains explicitly not availability.
