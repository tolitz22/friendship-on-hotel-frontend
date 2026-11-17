# Phase 38 — Staff Experience and Quality Gate

## Purpose

Previous milestones connected real Laravel operations but exposed too many technical/administrative tools on primary screens. This release improves daily staff tasks without changing backend booking, financial, readiness or permission rules. Source is committed to the frontend's default \`main\` branch; do **not** claim the UI has been visually accepted or the automated checks passed until they run.

## User experience changes

1. **Simpler navigation.** Daily operations are grouped (Overview, Front desk, Reservations, Rooms, Guests, Housekeeping, Maintenance, Billing). Management is separate (Reports, Settings, Staff, Security); diagnostics and simulations are behind a collapsible Advanced tools section.
2. **Accurate mode language.** The header no longer labels live Reservations, Front Desk, Maintenance or Housekeeping as a generic "MOCK PREVIEW." Simulation, draft policies, partial-live billing and preview reports retain explicit non-production/partial labels. Mock mode remains plainly a design preview.
3. **Fast way to start.** Overview uses actual task entry cards linking to Front Desk, create booking, Cleaning Tasks and Guests, instead of making staff navigate room catalogue metrics first. The layout and topbar include task shortcuts in API mode.
4. **Reservation workflow.** New booking form comes first, with three explicit stages: select guest/stay, review room-type capacity and room subtotal, confirm a real booking. Guest creation links to the Guest directory. A confirmed booking shows what to do next. The existing reservation list is visible in a collapsible section, with per-page search, room assignment and check-in/out operations via reservation references; an optional rate/inventory comparison is collapsed by default.
5. **Rooms workspace.** Separate tabs for the physical room catalogue and the readiness/arrival dashboard. Individual room inspections are opened from clear "Open inspection" controls. Hotel-level readiness enforcement is under an administrator-only Advanced disclosure, with its revision/confirmation protections unchanged.
6. **Helpful recoveries.** Shared query-feedback UI presents human-readable loading, no-results, session expiration, 403 permission, 409 stale-state, server/network messages and a Retry action where wired. It never falls back to fixture data or pretends a failed request succeeded.
7. **Responsive and accessible styling.** Scrollable navigation, focus treatments, larger touch-targets, restrained content sections, responsive task cards and reduced-motion loading state.

## Files

\`\`\`text
src/components/AppShell.tsx
src/pages/LiveDashboard.tsx
src/pages/LiveReservations.tsx
src/pages/LiveBookingForm.tsx
src/pages/LiveFrontDesk.tsx
src/pages/LiveRooms.tsx
src/components/QueryFeedback.tsx
src/components/ReadinessDashboardPanel.tsx
src/styles.css
src/components/AppShell.test.ts
src/components/QueryFeedback.test.ts
.github/workflows/phase38-frontend-checks.yml
\`\`\`

## CI and commands

New GitHub Actions workflows execute on \`main\` push, pull request and manual dispatch:

- Frontend: Node 22, dependency install, \`npm run typecheck\`, \`npm test\`, \`npm run build\`
- Backend: PHP 8.4, Composer dependency install, Laravel API route listing, full feature tests on SQLite and a separate MySQL 8.4 migration job

**Important existing issue:** the frontend currently has no \`package-lock.json\`. \`npm ci\` is therefore NOT valid on a fresh checkout. The Phase 38 workflow temporarily uses \`npm install --no-audit --no-fund\`. Developers should run:

\`\`\`bash
npm install
npm run typecheck
npm test
npm run build
\`\`\`

After verifying the dependency tree, commit \`package-lock.json\` and change both the workflow and developer instructions to \`npm ci\` for reproducibility. Do not commit \`node_modules\`.

Backend:

\`\`\`bash
composer install
php artisan test
php artisan migrate --force   # only on an isolated migrated test environment
\`\`\`

Do not run migration changes against production before staging validation.

## Manual acceptance checklist

- Sign into a staff account, select a property, navigate all daily tasks using desktop keyboard and a narrow mobile viewport.
- Confirm the correct live/preview label for every route. Test the Advanced tools toggle and navigation active state.
- On the Overview page, use each task card. On Front Desk, switch date/queue, filter a current page, open the Reservations workspace and confirm no fixture fallback.
- On Reservations, select an existing guest (or open Guest directory), check stay and price, confirm with a unique idempotency key, handle a network timeout using the **same** key, and use the real saved reservation list. Do not mislabel the subtotal as final payable or inventory as held.
- In Rooms, switch from catalogue to readiness dashboard, start an inspection, approve from a different admin, and verify active-block and pending-housekeeping messages. Do **not** enable mandatory check-in gating in production solely to test its UI.
- Test two different hotels and confirm no cross-hotel details survive a property switch.
- Test expired sessions, unauthorized role access, 409 conflicts, empty databases and backend downtime. Retry must refetch data, not repeat a financial or reservation mutation automatically.
- Test mobile screen widths around 390px, tablet 768px and desktop 1440px, keyboard focus, form labels, and screen reader status/error announcements.
- Run the backend Phase 36/37 **true multi-process** concurrency suite and performance/runbook tests before production readiness enforcement. CI's MySQL migration job does not prove concurrency safety.

## Outstanding

The frontend and backend CI workflows have been committed, but their run results are **not confirmed**. This work does not replace real browser/visual QA, does not deliver new payment gateway functionality, and does not independently certify room readiness. Additional UX work should be guided by a real receptionist's daily workflow and observed usability feedback before broad design changes.
