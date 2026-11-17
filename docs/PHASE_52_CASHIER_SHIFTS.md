# Phase 52 — Cashier Shifts & Independent Reconciliation

The React/Vite PMS now has an API-mode `/cashier-shifts` workspace visible to the selected hotel's `front_desk` and `admin` roles. Other roles do not see its navigation link and Laravel separately rejects their API calls.

## Receptionist

1. Open a shift with a declared beginning float (shown in major currency units; API receives integers in minor units).
2. Record each cash collection against an existing **priced** reservation, with a unique payment reference. The app creates a stable idempotency request key and retains it across retries while the fields remain unchanged.
3. View their own shifts and event history. Expected cash is intentionally *not shown* before submitting a physical count.
4. Count notes/coins and submit closing cash separately from the expected ledger total. Once submitted, the shift cannot accept additional cash records or be edited.
5. Ask a manager to investigate any discrepancy; the UI never adjusts/reverses the counted amount.

## Manager

1. Open the Cashier shifts workspace, filter `submitted`, and review a cashier's declared count, expected cash, variance and audit history.
2. Inspect the associated **folio payment IDs, references and payment-review states** before reconciliation.
3. Reconcile only if variance is zero and every cash receipt is independently staff-confirmed via the existing financial review API. Otherwise mark the shift `flagged` with a required investigation note.
4. A manager cannot reconcile their own shift. Both role and separation-of-duty checks occur on the Laravel server.

## Financial boundaries

This feature **does not** settle money, initiate bank transfers, perform refunds, issue a keycard, prove cash drawer inventory or verify that an off-system guest paid. All new cash payment records are pending review in the existing folio ledger. Cash refunds/expenses, float transfers and physical cash handover remain out of scope.

The original manager-only `POST /bookings/{booking}/payment-records` route now returns 409 for cash: use the cashier shift receipt endpoint. Existing bank-transfer flows and Phase 51 approvals are unchanged.

## Release checklist

- Backend first: deploy migration and API before the new frontend screen. `php artisan migrate`.
- `php artisan test --filter=CashierShiftPhase52Test`, full `php artisan test`, PHP lint and MySQL/PostgreSQL concurrency tests.
- Frontend: `npm test`, `npm run build` and real-browser user acceptance for a front-desk cashier, manager, outsider, multiple properties, page changes and responsive layouts.
- Confirm a priced booking, an open shift, a cash receipt, pending review → independent confirmation, a physical cash count, and second-manager reconciliation.
- Verify shortages cannot be reconciled as balanced and that duplicate cash references/requests cannot generate additional receipts.
- Audit historical unlinked cash before deployment, and update legacy direct cash creation clients.

Source has been committed directly to `main`, but automated test results and live database rollout are not verified in this session.
