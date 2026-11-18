# Billing & Guest Folio — Acceptance and Reconciliation

## Scope delivered
- Live `GET /api/v1/hotels/{hotel}/finance/folios` replaces the frontend sample folio table. Results are hotel-scoped, paginated, searched by booking reference/ID and include posted ledger totals from `FolioAccountingService::summaryFor`.
- The Billing page links the original reservation, cashier shifts, itemized settlement statement, manager-only folio adjustments, bank-transfer evidence, payment review, verified allocations, refunds and signed checkout statements.
- The existing Laravel services remain the **only financial write path**. No browser-side payment calculation is trusted by the server. Cash is recorded through an open cashier shift, not directly in Billing.
- `SettlementPanel` now reads `/bookings/{booking}/settlement-statement`, matching the backend route. A successful write isn't misreported as a failed write if a later cache refresh fails.

## Required pre-production verification
Use a dedicated staging property and dummy funds, not real guests or production payments.

1. Run `php artisan test --filter=FinanceFolioIndexTest` and relevant existing folio, verification, cash shift, tax, refund, financial close, and settlement tests against the target database engine. Run `php artisan route:list --path=finance` and confirm `finance.read` permission for the list route.
2. Run `npm run build`, `npm test -- src/api/billing.test.ts`, and `npm run test:e2e:staging -- --grep billing` using `PMS_STAGING_URL`, `PMS_STAGING_READ_ONLY=1`, and dedicated role credentials.
3. Verify the directory excludes folios belonging to another hotel and never exposes records to unauthorized roles. Confirm search, pagination, no-results, missing-priced-folio and signed states.
4. With staging-only write test credentials and explicit operator approval, create bank-transfer evidence and confirm its status is **pending review**; a different administrator should confirm it. Confirm same request key replays safely, while a changed payload with that key gets 409.
5. Record a cash payment only through an active cashier shift; submit drawer count and require reconciliation before independent cash verification.
6. Record credit/debit adjustments with a valid reason and confirm their effect on posted charges, journal locks and any approved VAT allocation. Check negative/overdue balances separately; never use staff-confirmed evidence as proof that funds reached the bank.
7. Verify verified payment allocations, group/company payer attribution, split billing, deposit handling and independent refund/disbursement reviews. The PMS **does not send a bank refund**.
8. Confirm manager-only settlement signoff is prevented by blockers (unverified evidence, unmatched allocations, pending refunds, outstanding room-night tax allocation, wrong stay date). Once signed, further ordinary financial writes must be rejected and snapshot integrity must remain true.
9. Print signed and unsigned statements. A provisional statement is **not** a BIR tax invoice, bank receipt or independent payment proof. Confirm no staff-facing backend names or environment variables appear.
10. On 390px mobile check list, search, statement tables (horizontal scrolling inside table), modal/manager forms and print preview. Check network errors never encourage repeating uncertain financial writes with a new idempotency key.

## Production gating
A successful Railway deployment/build is **not** complete reconciliation. `FINANCE_ENABLE_VERIFIED_SETTLEMENT` and `FINANCE_ENABLE_LIVE_FOLIO_TAX` must only be enabled after finance sign-off, review of applicable Philippine tax rules, migrations and full integration tests. Activation is a separate controlled decision.

## Role acceptance
- Reception: view permitted folios/statements, navigate to cashier shifts; no manager-only adjustment, verification, refund or signoff.
- Administrator: audited adjustment/evidence actions and independent review, subject to separation-of-duties and outstanding blockers.
- Housekeeping/maintenance: no financial account listing or mutations.

## Status
Routes, UI and backend isolated tests were committed to main. Railway deployment checks confirm compilation and deployments only. Browser E2E execution and a complete finance sign-off with production-equivalent database are still required before declaring the full financial workflow production-ready.


## Guest payment entry (cash and bank transfer) — new acceptance checks

- Open a guest account from Billing. Verify that the **Record a guest payment** section is visible for an unsigned folio and hidden when the folio is signed.
- Use a dedicated front-desk staging account with no open shift: verify the user must count and confirm opening float before an open shift can be created. An existing submitted shift must not be silently reopened.
- Verify the current drawer lookup returns **only the logged-in cashier's** open shift, even if a manager can view all hotel shifts. Validate tenant and role permissions.
- With an open shift, enter **Payment amount ₱2,500.00** and **Cash handed to you ₱3,000.00**. The change displayed must be **₱500.00**. Insufficient cash disables Record payment; no write should occur. Validate decimal input and missing confirmation.
- Staging-only mutation testing with explicit approval: submit a ₱2,500 cash receipt against the guest's booking; assert that the **folio payment and cashier-shift receipt contain ₱2,500**, not ₱3,000; the difference is physically returned as change and not posted as additional revenue. Confirm cash evidence is still pending independent review.
- Retry the same idempotency request after a simulated uncertain network outcome. It must replay the original receipt, not post another ₱2,500 transaction. Do not assume a failed network response means no receipt was saved.
- A front-desk user may record cash using their own shift, but cannot review bank evidence as a manager. The bank evidence option is manager-only; cash receipts do not bypass shift reconciliation.
- Confirm all changes to folio balance remain provisional until payment review and finance settlement. The account statement is not a tax invoice.
- On 390px mobile, verify the guest summary, Cash / Bank transfer selector, payment amount, tendered cash and change remain easy to read. The itemized statement and manager tools should expand only when needed.
- Test the shared URL `/billing?booking=%222%22` resolves to booking **2** without accepting arbitrary query strings as IDs.

Automation currently covers input arithmetic, quoted booking IDs and read-only staging form behavior; the cash mutation, receipt identity and cash-drawer reconciliation acceptance checks require a controlled staging run before production sign-off.
