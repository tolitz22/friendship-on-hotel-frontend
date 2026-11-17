# Phase 50 — Fine-Grained Permissions UI

This update builds on Phase 49 and the companion Laravel Phase 50 branch.

- **Receptionists** now see the live New reservation flow, can assign physical rooms, and can confirm eligible check-ins/checkouts. All writes still go to the selected hotel's authenticated Laravel API and are subject to backend permissions, date and inventory checks, current hotel membership and readiness policy.
- **Housekeeping** continues to update only linked own tasks; other hotel staff cannot impersonate a task assignee via the client.
- **Managers** (`admin` in the current backend) still own cancellations, manual payment/refund reviews, settings, staff access, guest creation and inventory block changes.
- The booking form hides the **Add new guest** action from receptionists until a separately audited guest-intake workflow exists. Receptionists can book existing registered guests.
- Reservation activity retains immutable actor IDs from Laravel; frontend acknowledgements are not identity verification or physical occupancy proof.
- Phase 50 does not introduce a manager approval request inbox or a distinct manager role. Existing approval endpoints and independent-review rules remain authoritative.
- Switching hotels recomputes role-based action visibility; Laravel independently enforces the property context.

## Rollout

Deploy Laravel Phase 50 first. All bearer-token receptionists must log in again to obtain the newly issued `booking:write` token ability. Trusted first-party SPA sessions use the existing session authentication and current hotel membership.

Verify with `npm test`, `npm run build`, then browser acceptance covering receptionist booking → room assignment → check-in/out, housekeeping isolation, hotel switching, invalid token ability and manager-only financial actions. Full CI/build and live browser runs were not executed during the authoring session.
