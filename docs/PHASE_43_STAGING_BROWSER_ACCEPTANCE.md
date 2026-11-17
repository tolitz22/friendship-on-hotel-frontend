# Phase 43 — Real React → Laravel Staging Browser Acceptance

The Phase 43 backend acceptance suite is in the Laravel repo, and the frontend now includes a separate **opt-in, destructive staging-only** Playwright suite. It is deliberately NOT included in push/PR checks or the original **read-only** staging smoke test.

- Config: `playwright.staging.write.config.ts`
- Browser tests: `e2e/staging-write/guest-to-checkout.pw.ts`
- Command: `npm run test:e2e:staging:write`
- GitHub Actions: **Phase 43 isolated staging write acceptance** (manual dispatch, environment `staging-write`)

## Provisioning requirements

1. Deploy the actual React/Vite app with `VITE_DATA_SOURCE=api` and `VITE_API_URL=https://api.staging.example.com/api/v1`, rebuilding after changing these build-time settings. Select `VITE_AUTH_MODE=token` for independently hosted Railway `*.up.railway.app` frontend/API hosts, or `VITE_AUTH_MODE=cookie` for same-site custom staging hostnames with correctly configured Sanctum cookies. Set GitHub `PMS_STAGING_AUTH_MODE` to the exact deployed frontend mode.
2. Deploy Laravel to an isolated, disposable **staging database** with migrations. Configure trusted frontend origins. For cookie mode only: configure Sanctum stateful hosts, secure session cookie, same-site behavior, a shared staging cookie domain (for example `SESSION_DOMAIN=.staging.example.com`) exposing the XSRF cookie to the trusted SPA, and CSRF. **Do not share any production DB, payment keys, customers or booking inventory.** A Railway hostname containing `production` in its name is NOT proof that it is a production service or an isolated staging service: verify actual Railway environment and DB reference before enabling writes.
3. Provision a synthetic hotel with at least one bookable physical room, matching room type, active nightly rate, and administrator account. Choose a room/type with no inventory blocks or reservation conflicts on **today's Asia/Manila date** and the following night. The real check-in workflow requires its readiness policy to permit check-in; if enforcement is on, provision an independently approved readiness inspection.
4. For the optional checkout test, provision a second, **synthetic, already checked-in booking** assigned to a room with scheduled checkout on/before today's hotel-local date. Set `PMS_STAGING_CHECKOUT_BOOKING_ID` to run it. Otherwise the checkout test is skipped (report an incomplete acceptance gate, NOT a full Phase 43 pass). Its checkout will create a real housekeeping turnover task. Provision a fresh fixture for each acceptance run; never reuse a checked-out booking.
5. In the frontend GitHub repo, create the **staging-write** environment and require reviewer approval. Configure the following **environment variables** with actual IDs and exact hostnames:

   - `PMS_STAGING_ISOLATED_DB_ACK=isolated-test-db` — set ONLY after independently verifying the disposable staging PostgreSQL deployment
   - `PMS_STAGING_AUTH_MODE=token` for your currently deployed Railway bearer-token application (or `cookie` for same-site custom-domain deployment)
   - For the exact hardcoded Railway pair `friendship-on-hotel-frontend-production.up.railway.app` and `friendship-on-hotel-backend-production.up.railway.app`, also set `PMS_STAGING_RAILWAY_HOSTS_ACK=separate-disposable-db-no-production-data`, only after verifying the service/database are disposable and contain **no** production records. All other non-staging hosts are rejected.
   - `PMS_STAGING_URL` — e.g. `https://pms.staging.example.com`
   - `PMS_STAGING_ALLOWED_HOST` — e.g. `pms.staging.example.com`
   - `PMS_STAGING_API_URL` — e.g. `https://api.staging.example.com/api/v1`
   - `PMS_STAGING_ALLOWED_API_HOST` — e.g. `api.staging.example.com`
   - `PMS_STAGING_TEST_HOTEL_ID`, `PMS_STAGING_TEST_HOTEL_NAME`
   - `PMS_STAGING_TEST_ROOM_TYPE_ID`, `PMS_STAGING_TEST_RATE_PLAN_ID`, `PMS_STAGING_TEST_ROOM_ID`
   - `PMS_STAGING_CHECKOUT_BOOKING_ID` — optional fresh checked-in due fixture; absent means checkout test skipped

6. Set **environment secrets** `PMS_STAGING_STAFF_EMAIL` and `PMS_STAGING_STAFF_PASSWORD`. Use a newly created administrator with access only to the synthetic staging property. Never commit credentials or use an existing personal/production account. If a password has been pasted into a chat, rotate it BEFORE adding it to GitHub Secrets.

The workflow sets `PMS_STAGING_WRITE_ENABLED=1` only during the manual, approved run. To invoke locally, set that variable as well as the isolated-db acknowledgment, other required environment variables, and credentials, then run the write test command. There is no fallback to mock data or localhost.

## What the suite checks

The browser signs into the actual Laravel-backed React app using the configured token or cookie authentication, creates a synthetic guest via the React guest modal, links the guest to a priced booking, views actual availability and quote, creates the booking, assigns a real room, checks in on the hotel's arrival date, and verifies real backend HTTP responses. A separate authenticated **Playwright API request** (using the browser login's bearer token in token mode, or a credentialed browser fetch in cookie mode) also creates a **synthetic cash payment evidence record**, reviews it through the Laravel endpoint, reads the real folio ledger, and verifies that it is **staff_confirmed**, not bank-verified or settled.

A second browser test opens a preseeded checked-in stay due for checkout, checks it out through React, and confirms that the linked housekeeping turnover task is exposed. Checkout cannot occur on a newly created future-departure booking because Laravel correctly rejects early checkout.

**Important limitation:** The current React reservation operations UI does **not** have a complete payment-recording/review screen. The payment portion is exercised directly against Laravel from the authenticated browser, not through a cashier UI. The write suite does not independently verify real payments, bank settlement, refunds, taxes, final amounts due, physical identity, keycards, or parallel load.

## Pass criteria

- Main-branch frontend typecheck/unit/build and backend SQLite/PostgreSQL/MySQL validation succeed.
- This manually dispatched staging write suite passes against a separately deployed, isolated and appropriately provisioned staging frontend/API/database, with **both browser tests executed** (no checkout skip).
- Inspect only test names, HTTP status codes and synthetic booking IDs as necessary; tests intentionally **disable screenshot, trace and video** to prevent guest and credential leakage.
- Confirm the exact staging deployment commit SHAs. A green unit-test badge alone is **not** staging acceptance.
- Reset the synthetic staging DB/fixtures before rerunning; test writes are persistent.

## Railway staging preflight (November 2026)

For the currently deployed token-based `*.up.railway.app` services, configure the GitHub environment with actual frontend/API hostnames and these exact additional values:

```dotenv
PMS_STAGING_AUTH_MODE=token
PMS_STAGING_RAILWAY_HOSTS_ACK=separate-disposable-db-no-production-data
```

Do **not** enable the write acknowledgment until the Railway PostgreSQL service is confirmed to be isolated from your production datasets and the hotel contains synthetic-only records. The test writes persisted guest, booking and payment-evidence records; it does NOT clean them automatically. Rebuild/redeploy the frontend with `VITE_AUTH_MODE=token` before dispatch. Token-mode tests navigate inside the React SPA without full-page reload because its tokens are memory-only.
