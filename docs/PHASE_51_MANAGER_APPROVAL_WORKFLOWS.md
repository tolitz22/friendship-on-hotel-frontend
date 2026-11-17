# Phase 51 — Manager Approval Requests

## Included

- New `/manager-approvals` workspace, available in the manager/administrator menu.
- Pending/executed/rejected filters, pagination, explicit approve-and-execute or reject actions, manager notes, and expandable actor audit.
- Reservation detail panel: receptionist or admin can request an exception and see the status of their own requests (admin sees all within that hotel).
- Typed `managerApprovals.ts` adapter with tenant/booking response checks, a stable idempotency key across retries, and query invalidation following a completed review.
- Manager-only navigation and unit tests for response scope and status validation.

The initial queue deliberately supports **unpriced reservation cancellations** and **unpriced pre-arrival date amendments only**. A manager approval automatically invokes the existing backend reservation service within one transaction. Manager review does not override existing inventory, room readiness, or financial restrictions.

The web UI shows the booking's snapshot, proposed change, requester ID, reason, expiry and last review status. It requires the manager's explicit confirmation before execution; the backend independently checks role, different reviewer, hotel identity, request expiry and stale booking status.

## Release checklist

1. Deploy Laravel Phase 51 and run `php artisan migrate` before serving the new UI.
2. Run `npm test`, `npm run build`, and browser tests against an isolated staging hotel.
3. Test creating requests with reception tokens with `hotel:read` and `booking:write`, manager review with `hotel:write`, and cancellation/date audit entries.
4. Verify duplicate request retry, different hotel selection, expired approvals and declined requests.
5. Confirm that priced bookings remain blocked and no payment/refund/reversal is initiated by this workflow.

No automatic push notifications or scheduled expiration job are added. An expired pending record remains visible as pending, but the backend rejects review with 409; a new request must be submitted.

No production rollout or automated CI pass is claimed by this code update.
