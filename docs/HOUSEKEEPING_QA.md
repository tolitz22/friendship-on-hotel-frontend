# Housekeeping UI and role QA

## Purpose
Verify that Housekeeping supports day-to-day cleaning work without changing room readiness or violating staff permissions. All staging tests are read-only: no cleaning updates, task creation, guest records, or payments are submitted.

## Requirements
- Dedicated HTTPS staging frontend and backend, seeded with several tasks in each status and one past-due incomplete task.
- Dedicated **administrator** and **housekeeping** staging users, in the same property. Include at least one task assigned to housekeeping staff and one task assigned to another staff member.
- Set `PMS_STAGING_READ_ONLY=1` and the `PMS_STAGING_URL`.
- Set `PMS_STAGING_EMAIL` / `PMS_STAGING_PASSWORD` for general smoke tests.
- Set `PMS_STAGING_ADMIN_EMAIL` / `PMS_STAGING_ADMIN_PASSWORD` and `PMS_STAGING_HOUSEKEEPING_EMAIL` / `PMS_STAGING_HOUSEKEEPING_PASSWORD` to run role checks.

Execute using `npm run test:e2e:staging -- --grep housekeeping`. Run only against a dedicated staging environment. Never commit credentials.

## Acceptance checklist
- All three hotel-wide summary totals (**To do**, **In progress**, **Completed**) agree with status-filtered task list counts across its pages and remain unchanged when selecting another status tab. New task completion should change both affected totals after reload.
- The **Past due · current page** card reflects only incomplete tasks with a due date before the property's current local date. Do not interpret it as a hotel-wide overdue count.
- Status and type are server-wide filters; text search and **My tasks** are limited to the current page, and wording states this plainly.
- Administrator sees **New cleaning task**, assignment controls, and permitted progress choices. Housekeeping staff cannot create tasks or change assignments; only tasks linked to their staff account permit updates.
- Read-only users cannot save; completed tasks are not reopened by viewing their details.
- Missing maintenance list pages are reported as incomplete evidence; a cleaning completion never automatically changes room approval.
- Mobile 390px: status tabs, filter controls, cards and task dialog remain navigable without page-level horizontal scrolling.
- Direct task link for a task outside the current page still opens that specific record.

## Execution limitations
The GitHub/Railway build status verifies compilation/deployment only, not actual UI interactions. The automated browser suite must be run from an environment able to reach the staging frontend. Track pass/fail evidence separately for administrator and housekeeping accounts.
