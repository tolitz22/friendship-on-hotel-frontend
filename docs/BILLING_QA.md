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
