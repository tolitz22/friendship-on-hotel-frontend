# Reservation Management Usability Refresh

The live PMS `/reservations` workspace now separates the two primary tasks:

- **Manage reservations**: the default view for existing guest stays. Presents paginated, guest-centered cards with status, room category, dates, physical assignment and the next recommended action. Search by guest name, booking ID/reference or room number searches across the selected hotel, not merely the loaded page. Status filters are server-driven (`all`, `needs_room`, `arrivals`, `in_house`, `completed`). Results order newest reservations first.
- **New reservation**: a focused three-step booking wizard (guest/date/rate → availability/review → confirmation), available via the `?mode=new` deep link. Existing Guest and Room Calendar deep links continue to prefill booking context. Confirmed bookings open the room assignment detail when requested.

## Selected reservation workflow

Opening a reservation displays only that reservation, with a clear back link, guest and room summary, stage indicator, and **What happens next?** guidance.

- Confirmed without a room: room assignment is the primary step, with selectable compatible physical-room cards and conflict/maintenance descriptions.
- Confirmed with a room: the page prioritizes check-in eligibility and acknowledgment. The detailed room picker is hidden until **Change assigned room** is requested.
- Checked-in: focuses on departure/check-out eligibility.
- Checked-out: directs staff toward the linked housekeeping handoff.
- Manager exceptions and reservation audit history remain available but are collapsed rather than interrupting the primary workflow.

Laravel continues to enforce permissions, inventory conflict checks, readiness policies and authoritative stay transitions. The UI does not auto-assign, auto-check-in, override finances or bypass manager approvals.

## Backend support

`GET /api/v1/hotels/{hotel}/reservation-records` accepts `search` (up to 100 characters), `filter`, `page`, and `per_page`. Hotel-scoped guest names and existing room labels are returned to authorized staff. Search is case-insensitive across SQLite, MySQL and PostgreSQL, and the result set is paginated before being sent to the browser.

Deploy the backend before the updated frontend to enable full-hotel search and filtering. Older backend responses could show mismatched search results if only the frontend has been deployed.

## Verification checklist

```bash
# Backend
php artisan test --filter=ReservationManagementSearchTest
php artisan test

# Frontend
npm test
npm run build
```

Browser acceptance: test new booking from Front Desk; guest-directory and room-calendar links; returning from a reservation detail; search across more than one page; all status filters; room assignment with blocked/occupied alternatives; check-in blocked by readiness; checkout timing; read-only roles; hotel switching; and mobile layouts.

CI and deployment status must be checked for the latest commits; passing earlier commits does not prove the latest rollout.
