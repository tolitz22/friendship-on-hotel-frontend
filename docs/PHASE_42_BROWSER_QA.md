# Phase 42 — Automated Browser QA and Staging Smoke

## Implemented on frontend main

This milestone introduces browser-level checks, with a strict separation between safe, automatic mock-preview tests and manually approved staging smoke tests. None of these tests books a real guest, changes room inventory, checks in/out an actual reservation, or modifies housekeeping work.

### Automatic mock-mode browser QA

Files:
- playwright.config.ts
- e2e/mock/staff-navigation.pw.ts
- package.json scripts test:e2e and test:e2e:staging
- .github/workflows/phase38-frontend-checks.yml

The Playwright mock suite starts Vite with VITE_DATA_SOURCE=mock on localhost:5173. It runs Chromium at desktop 1440 x 900 and an emulated iPhone 13 viewport. Checks include:
- Honest DESIGN PREVIEW labels on mock pages.
- Daily operations navigation and mobile drawer open/close behavior.
- Calendar/List reservation display controls and room Grid layout controls.
- A visibly simulated booking wizard that opens and closes without saving a reservation.
- Theme switching and preservation of the current route.
- No uncaught JavaScript page errors while browsing core staff pages.

On GitHub pushes and pull requests, the existing frontend workflow now also installs Chromium, executes npm run test:e2e, and uploads mock-only Playwright failure reports for seven days. CI continues to run TypeScript, Vitest, and production Vite build first. Browser screenshots and traces from mock preview are permitted in this failure artifact because mock data is fictional.

### Manual, read-only staging smoke

Files:
- playwright.staging.config.ts
- e2e/staging/read-only-staff.pw.ts
- .github/workflows/phase42-staging-smoke.yml

This suite is intentionally NOT triggered by push or pull request. It must be started manually in GitHub Actions, using a protected staging environment with the following environment secrets:
- PMS_STAGING_URL: the deployed staging frontend URL (HTTPS, except localhost).
- PMS_STAGING_EMAIL: an authorized *read-only* staging staff account.
- PMS_STAGING_PASSWORD: the staging account password.

The workflow sets PMS_STAGING_READ_ONLY=1. The test signs in, selects a property if prompted, and navigates using TanStack Router SPA links. It checks that the Guests, Front Desk, Reservations, Rooms, Housekeeping, and Maintenance pages open in live mode without the generic data-load error. It never clicks create, edit, assign, check-in, checkout, policy or payment actions.

The staging config disables screenshots, videos and traces to avoid recording guest data in artifacts. Use a staging database populated with synthetic test records, not actual guest PII. An approved staging hostname, protected environment and least-privileged account are required for responsible use. Staging tests do not claim financial correctness, privacy compliance or complete booking lifecycle verification.

### Local verification commands

Frontend:

    npm install
    npx playwright install chromium
    npm run typecheck
    npm test
    npm run build
    npm run test:e2e

On Linux CI, use npx playwright install --with-deps chromium instead.

Staging smoke (PowerShell example, using a dedicated staging test account):

    $env:PMS_STAGING_URL="https://YOUR-STAGING-HOST"
    $env:PMS_STAGING_EMAIL="YOUR-TEST-STAFF-EMAIL"
    $env:PMS_STAGING_PASSWORD="YOUR-TEST-STAFF-PASSWORD"
    $env:PMS_STAGING_READ_ONLY="1"
    npm run test:e2e:staging

Never commit staging credentials or put them in command-line arguments on shared machines.

### Dependency lockfile status

The frontend repository does not yet have a verified package-lock.json. The workflow uses npm install, NOT npm ci. The model's working container could not access npmjs.org due DNS/network restrictions, so a valid resolved lockfile could not be generated or verified here. From a network-enabled developer machine, run npm install, inspect and commit the resulting package-lock.json. Then replace npm install with npm ci in GitHub Actions for a reproducible build. Never synthesize or handwrite package lock checksums.

### Verification boundary

These files were committed to GitHub, but no successful Playwright, Vitest, TypeScript, Laravel or browser run has been confirmed in this session. The GitHub connector's available commit-workflow lookup is limited to associated pull-request runs and is not proof of the status of push-triggered jobs. Inspect the real Actions tab and failure logs before declaring a green build.

This milestone adds no backend migration or changes to check-in/room readiness. The Phase 36 opt-in transactional room-readiness policy remains off by default and still requires true multi-process MySQL/PostgreSQL concurrency tests before production activation.

## Next quality gates

- Review and fix actual GitHub Actions run failures.
- Commit a generated npm package-lock.json and adopt npm ci.
- Run mobile and desktop real-user usability acceptance against staging.
- Add a non-production synthetic fixture suite for actual write workflows, including booking idempotency, room conflict checks, check-in/out and turnover.
- Run multi-process database concurrency and hotel lock contention tests.
