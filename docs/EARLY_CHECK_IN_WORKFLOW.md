# Early arrival UX and approval audit

The reservation detail now explains normal check-in eligibility directly alongside the button, rather than leaving an unexplained disabled control.

For a confirmed assigned-room booking **one hotel-local calendar day before scheduled arrival**, front-desk staff can choose **Request early check-in**, enter a reason (at least 10 characters), and submit an idempotent request. The request remains pending; it does **not** bypass check-in, encode a keycard or charge a guest.

A **different hotel manager** reviews it in the existing manager approval inbox. The UI requires review acknowledgment and a meaningful note and warns that approval immediately performs check-in. Laravel rechecks the booking, date, room inventory (including the additional night), active room blocks, and enforced room readiness, then writes an early-arrival record within the approval transaction.

The manager's approval changes the operational arrival date to the real hotel-local date so the extra occupied night cannot be double-booked. The original scheduled check-in/check-out remain in `reservation_early_check_ins`, with actual date/timestamp, requester, approver, manager note, reason, and approval ID. The booking details and reservation list display **Early check-in**. Booking activity records the distinct event `early_check_in`.

The workflow intentionally supports **only one day early** for now; older and stale requests are rejected. This is an exception to the standard date rule, not a general date amendment. It does not automatically bill extra nights, process refunds, or alter existing folio amounts; the manager must use the finance workflow for rate adjustments. The original scheduled date remains visible in the early-arrival audit rather than being mistaken for the current operational inventory date.

## UX refinement

The previous manager-exception section is styled as a compact panel with short request history rows, while early check-in has its own context-sensitive, prominently accessible request action. Approval cards distinguish early check-in from cancellation and date changes, and confirm that approval itself performs a check-in.

## Verification

```bash
npm ci
npm test
npm run build
```

Backend must deploy the new migration and approval changes before the frontend for end-to-end execution. Test guest arriving one day before booked date, missing room, conflicting prior-night stay, pending/expired review, denial of self-approval, confirmed early audit record and clear mobile layout.

No CCTV or keycard functionality was re-enabled.
