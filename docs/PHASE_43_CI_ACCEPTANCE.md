# Phase 43 — Green CI and workflow acceptance

## Current gate: NOT GREEN

The repository does not currently contain a committed `package-lock.json`. The frontend workflow now requires one and uses `npm ci`, so the workflow intentionally fails fast until the lockfile is generated and committed. **Do not merge this change before that prerequisite is satisfied.**

## Prepare deterministic dependencies

Use Node 22 and npm 10 (the same major versions as CI):

```bash
node --version
npm --version
npm install --package-lock-only
npm ci
npm run typecheck
npm run test
npm run build
npx playwright install --with-deps chromium
CI=true npm run test:e2e
```

Commit `package-lock.json` to this branch. Review the diff for unexpected dependency changes. Do not replace `npm ci` with `npm install` to bypass CI failures.

## What CI validates

- TypeScript compile and production bundle
- Vitest unit suite
- Playwright mock-mode desktop and mobile Chromium acceptance
- Playwright report, screenshots, traces and videos **only on failing CI jobs**, retained for seven days

All of these must pass on the same commit. Do not treat a green mock-mode suite as proof of backend writes, billing, or real guest workflows.

## Dedicated staging

Configure a GitHub **Environment** named `staging` with required reviewers, and its variables:

- `PMS_STAGING_URL`: an HTTPS origin pointing to the isolated staging frontend
- `PMS_STAGING_ALLOWED_HOST`: its exact dedicated DNS hostname

Run **Read-only staging smoke** manually from Actions. It rejects missing/mismatched hostnames and runs existing `e2e/staging` checks with `PMS_STAGING_READ_ONLY=1`. The staging environment must use synthetic guest records, non-production payment gateways, separate database credentials and no live customer data. Restrict writes and never grant production API secrets to staging.

Existing staging smoke tests are explicitly **read-only**. A guest-to-checkout acceptance signoff requires separate, disposable, writable synthetic end-to-end tests proving: guest creation, room eligibility, reservation, check-in, folio, sandbox settlement, checkout, and audit trail. Include unauthorized-role, double-booking, timeout/retry and rollback assertions. They must check persisted backend state and clean up test data. Do not claim this signoff from the read-only smoke alone.

## Outstanding acceptance blockers

1. Commit the npm lockfile, run the workflow and inspect the actual failing logs.
2. Fix any TypeScript, unit, browser, or backend errors reported by a real run.
3. Confirm the backend CI suites pass against SQLite, PostgreSQL and MySQL.
4. Deploy isolated staging and add **writable synthetic guest-to-checkout** acceptance with payment sandbox and audit verification.
5. Mark Phase 43 complete only when all above are evidenced on a recorded commit.
