# Overview and Front Desk — live desktop/mobile acceptance

**Scope:** authenticated, read-only verification of the deployed React/Vite
dashboard and Front Desk. Designed for a **dedicated staging database** and
staff account; not a payment or guest-data mutation suite.

## Prerequisites

- Latest frontend `main` deployed to the selected **staging** environment.
- Matching backend and a dedicated authorized **manager** test account.
- HTTPS front-end address; Playwright Chromium installed.
- `PMS_STAGING_READ_ONLY=1`, `PMS_STAGING_URL`,
  `PMS_STAGING_EMAIL`, `PMS_STAGING_PASSWORD` supplied **locally as
  environment variables**, never in files, logs or git commits.
- No guest PII screenshots, Playwright traces or videos are recorded by the
  staging configuration.

## Run

```bash
npm ci
npx playwright install chromium
npm run test:e2e:staging
```

The `overview-front-desk-responsive.pw.ts` suite checks at desktop
1440×900 and mobile 390×844:

1. Manager Overview heading, summary and room inventory are present.
2. New Reservation links to the creation flow but is **not clicked**.
3. Each Overview queue card deep-links to the corresponding Front Desk tab.
4. Sidebar navigation returns safely to Overview on both screen sizes.
5. The Front Desk date picker, next-day and today navigation are interactive.
6. Guest search can be cleared without editing or saving guest data.
7. The page has no document-level horizontal overflow on either viewport.

**What it does not certify:** correct occupancy/availability, financial
settlement, backend authorization, guest identity, or payment processing.

The existing smoke suite also runs with the command above. Use a fresh staging
account and test fixture, never a production credential. A passing Railway
build is **not** evidence that these Playwright tests have run.

## Manual inspection checklist

At desktop 1440×900 and mobile 390×844, inspect: font scaling, button
contrast, property selector, mobile sidebar dismissal, empty and failed queue
states, room label wrapping, long guest names, the pagination controls,
keyboard focus, and access roles. Record defects with sanitized screenshots
only when test data contains no personal information.

On shared/production systems: use view-only navigation. Never click
booking, check-in/out, refunds, payments, or room-assignment mutations
during UI visual acceptance.
