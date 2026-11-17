# Phase 43 — Real React → Laravel Staging Browser Acceptance

The Phase 43 backend acceptance suite is in the Laravel repo, and the frontend now includes a separate **opt-in, destructive staging-only** Playwright suite. It is deliberately NOT included in push/PR checks or the original **read-only** staging smoke test.

- Config: `playwright.staging.write.config.ts`
- Browser tests: `e2e/staging-write/guest-to-checkout.pw.ts`
- Command: `npm run test:e2e:staging:write`
- GitHub Actions: **Phase 43 isolated staging write acceptance** (manual dispatch, environment `staging-write`)

## Provisioning requirements

1. Deploy the actual React/Vite app with `VITE_DATA_SOURCE=api`, `VITE_AUTH_MODE=cookie` and `VITE_API_URL=https://api.staging.example.com/api/v1`, rebuilding after changing these build-time settings. The staging frontend and API MUST use separate, allowlisted **HTTPS** hosts including `staging` in the hostname. They must be same-site so first-party Sanctum cookies and the XSRF cookie work from the browser.
2. Deploy Laravel to an isolated, disposable **staging database** with migrations. Configure trusted frontend origins, Sanctum stateful hosts, secure session cookie, same-site behavior, a shared staging cookie domain (for example `SESSION_DOMAIN=.staging.example.com`) exposing the XSRF cookie to the trusted SPA, and CSRF in the deployment. **Do not share any production DB, payment keys, customers or booking inventory.**
3. Provision a synthetic hotel with at least one bookable physical room, matching room type, active nightly rate, and administrator account. Choose a room/type with no inventory blocks or reservation conflicts on **today's Asia/Manila date** and the following night. The real check-in workflow requires its readiness policy to permit check-in; if enforcement is on, provision an independently approved readiness inspection.
4. Provision a second, **synthetic, already checked-in booking** assigned to a room with scheduled checkout on/before today's hotel-local date. Use its reservation ID for the checkout test. Its checkout will create exactly one real housekeeping turnover task. Provision a fresh fixture for each acceptance run. Never reuse a checked-out booking.
5. In the frontend GitHub repo, create the **staging-write** environment and require reviewer approval. Configure the following **environment variables** with actual IDs and exact hostnames:

   - `PMS_STAGING_ISOLATED_DB_ACK=isolated-test-db`
   - `PMS_STAGING_URL` — e.g. `https://pms.staging.example.com`
   - `PMS_STAGING_ALLOWED_HOST` — e.g. `pms.staging.example.com`
   - `PMS_STAGING_API_URL` — e.g. `https://api.staging.example.com/api/v1`
   - `PMS_STAGING_ALLOWED_API_HOST` — e.g. `api.staging.example.com`
   - `PMS_STAGING_TEST_HOTEL_ID`, `PMS_STAGING_TEST_HOTEL_NAME`
   - `PMS_STAGING_TEST_ROOM_TYPE_ID`, `PMS_STAGING_TEST_RATE_PLAN_ID`, `PMS_STAGING_TEST_ROOM_ID`
   - `PMS_STAGING_CHECKOUT_BOOKING_ID` — the fresh checked-in due fixture

6. Set **environment secrets** `PMS_STAGING_STAFF_EMAIL` and `PMS_STAGING_STAFF_PASSWORD`. Use an administrator with access only to the synthetic staging property. No personal or production accounts.

The workflow sets `PMS_STAGING_WRITE_ENABLED=1` only during the manual, approved run. To invoke locally, set that variable as well as the isolated-db acknowledgment, other required environment variables, and credentials, then run the write test command. There is no fallback to mock data or localhost.

## What the suite checks

The browser signs into the actual Laravel-backed React app with cookie auth, creates a synthetic guest via the React guest modal, links the guest to a priced booking, views actual availability and quote, creates the booking, assigns a real room, checks in on the hotel's arrival date, and verifies real backend HTTP responses. An authenticated **browser-to-Laravel API** request also creates a **synthetic cash payment evidence record**, reviews it through the Laravel endpoint, reads the real folio ledger, and verifies that it is **staff_confirmed**, not bank-verified or settled.

A second browser test opens a preseeded checked-in stay due for checkout, checks it out through React, and confirms that the linked housekeeping turnover task is exposed. Checkout cannot occur on a newly created future-departure booking because Laravel correctly rejects early checkout.

**Important limitation:** The current React reservation operations UI does **not** have a complete payment-recording/review screen. The payment portion is exercised directly against Laravel from the authenticated browser, not through a cashier UI. The write suite does not independently verify real payments, bank settlement, refunds, taxes, final amounts due, physical identity, keycards, or parallel load.

## Pass criteria

- Main-branch frontend typecheck/unit/build and backend SQLite/PostgreSQL/MySQL validation succeed.
- This manually dispatched staging write suite passes against a separately deployed, isolated and appropriately provisioned staging frontend/API/database.
- Inspect only test names, HTTP status codes and synthetic booking IDs as necessary; tests intentionally **disable screenshot, trace and video** to prevent guest and credential leakage.
- Confirm the exact staging deployment commit SHAs. A green unit-test badge alone is **not** staging acceptance.
- Reset the synthetic staging DB/fixtures before rerunning; test writes are persistent.
