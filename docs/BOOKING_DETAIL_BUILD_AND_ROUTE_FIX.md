# Booking detail and Railway TypeScript fixes

## Railway build from uploaded screenshot

The screenshot shows `npm run build` failing at `tsc -b && vite build` in `src/pages/OccupancyVerification.tsx`:

- TS2345: `"flag"` was passed where the union requires `"flagged"`.
- TS2322 at the audit event loop: `unknown` values used as React key / children.

The code on `main` now submits `'flagged'`, with a typed audit-event rendering contract.

## Reservation detail and room assignment

The selected booking view shows guest name, room category, stay dates, current physical room and lifecycle. The main flow is organized as **1 · Choose the guest's room**, followed by **2 · Guest stay actions**. Manager exceptions and reservation history are collapsed secondary sections.

A new, booking-specific room-choice query lists only the booked room type. Cards identify:

- `Available` for rooms without identified overlapping conflicts;
- `Already booked` for an overlapping assigned reservation;
- `Maintenance block` for an active dated block;
- `Current room` for an already assigned room.

Incompatible rooms cannot be selected. Readiness/identity checks remain separate. Room choices are advisory: the Laravel assignment endpoint rechecks inventory and readiness-sensitive locks. Failed assignments due to a simultaneous competing booking trigger a refresh of the booking and room choices.

The reservation list now shows room labels and a visible **Assign room** / **View booking** action.

## Laravel 404 in approval requests and audit review

An actual response of `The route api/v1/hotels/1/approval-requests could not be found` is coming from the **deployed Laravel backend**, not React's local routing. Backend source on `main` already contains the approvals and operational exceptions routes. Deploy the backend `main`, apply migrations, clear Laravel's route cache, restart the server, and confirm the frontend `VITE_API_URL` matches the running backend. Do not bypass authorization to silence the 404. The UI now explains this version mismatch instead of asking users to retry blindly.

For backend route checks and deployment commands, see `docs/ROOM_ASSIGNMENT_AND_ROUTE_DEPLOYMENT_FIX.md` in the backend repo.

## Regression verification

```bash
npm ci
npm test
npm run build
```

Server-side:

```bash
php artisan migrate --force
php artisan optimize:clear
php artisan test --filter=RoomChoicesReservationUxTest
php artisan route:list --path=api/v1/hotels
```

These commands must run on the relevant target machines. A successful source commit does **not** verify a passing Railway deployment, production database migration, or browser session. Verify the actual Railway build status separately.
