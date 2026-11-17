# Phase 18 — Secure hotel staff email invitations

## What this milestone adds

An active hotel administrator can now invite a **new staff account** from the **Hotel staff** page without creating or distributing any temporary password.

1. In API mode, the admin chooses the recipient's name, email and hotel role (`admin`, `front_desk`, `housekeeping` or `maintenance`).
2. Laravel saves a 48-hour invitation, stores **only the SHA-256 hash** of a 64-character cryptographically generated token, and dispatches an email to that address through the configured Laravel mail transport.
3. The recipient follows the link to `/accept-invitation?token=...`, where they choose and confirm their own password. The browser removes the token from the address bar and history after reading it.
4. The public acceptance endpoint validates token, expiry, single-use state and password complexity (minimum 12 characters, upper/lowercase and numbers). In one database transaction it creates the user, marks the email verified by possession of the sent link, creates **one active membership in the invited hotel only**, marks the invitation accepted, and records a hotel staff membership audit event.
5. The recipient can then sign in using Phase 16/17 authentication. **Acceptance does not sign the recipient in automatically.**

The invite does **not** create an account or grant hotel access until it is accepted. Re-inviting the same hotel/email revokes older unused links. The admin can revoke unused invitations in the UI; accepted or revoked links cannot be reused. The list contains the latest 100 invitations with status, but **never returns token hashes or plaintext invite tokens**.

This is a new-account flow. If an email already belongs to an existing Laravel account, invitation creation returns HTTP 422 and the admin must use **Attach an existing account**. Acceptance also refuses to take over an email that became registered after the invite was issued. Existing-account ownership is never automatically changed.

## API endpoints

```http
GET   /api/v1/hotels/{hotel}/staff/invitations
POST  /api/v1/hotels/{hotel}/staff/invitations
PATCH /api/v1/hotels/{hotel}/staff/invitations/{invitation}/revoke
POST  /api/v1/auth/accept-invitation
```

The first three endpoints are behind `auth:sanctum`, active user, selected hotel membership and `hotel.admin`. Sending is additionally throttled (10 requests/minute per caller). Acceptance is unauthenticated but throttled (5/minute) and requires the one-use random token.

Create payload:

```json
{"name":"Cleaner A","email":"cleaner@example.com","role":"housekeeping"}
```

Acceptance payload:

```json
{
  "token":"ONE_USE_TOKEN_FROM_EMAIL",
  "password":"StrongPersonalPassword123!",
  "password_confirmation":"StrongPersonalPassword123!"
}
```

No endpoint reveals an invitation token to staff administrators. The email link alone carries the acceptance token. Tokens are not used as API tokens; they permit **only** account creation within the invitation's stored hotel and role.

## Database migration

`database/migrations/2026_11_17_000008_create_staff_invitations.php` creates `staff_invitations` with scoped hotel/actor IDs, email, name, role, unique token hash, timestamps and accepted/revoked/expiry dates. It is implemented using standard Laravel schema and query-builder operations compatible with MySQL 8.4/InnoDB and PostgreSQL 16+.

**Run `php artisan migrate` before using invitation endpoints.**

## Email and frontend configuration

The backend uses existing `config/mail.php` transport settings and new trusted server-side `STAFF_INVITE_URL`:

```dotenv
STAFF_INVITE_URL=http://localhost:5173/accept-invitation
MAIL_MAILER=log
MAIL_FROM_ADDRESS=no-reply@example.test
```

With the local `log` mailer, the email contents and acceptance link appear in Laravel's log (usually `storage/logs/laravel.log`); they are **not actually delivered**. For production configure SMTP/provider mail delivery, verified sender domain, TLS/HTTPS and:

```dotenv
STAFF_INVITE_URL=https://pms.example.com/accept-invitation
MAIL_MAILER=smtp
```

The frontend remains `VITE_DATA_SOURCE=api`. Either the Phase 17 cookie session flow (`VITE_AUTH_MODE=cookie`) or existing bearer development mode can be used. In cookie mode, accepting invitations performs Sanctum CSRF initialization. Do **not** put invitation SMTP credentials or token configuration into frontend environment variables.

## Security boundaries

- Only authenticated, active hotel admins can issue, view or revoke invites for that hotel.
- The invitation URL and token are never set from request redirect parameters.
- Passwords are chosen by the recipient and hashed by Laravel's model cast.
- Email verification is established **when an unexpired one-use link sent to that mailbox is redeemed**, not when it is issued.
- Accepting an invitation cannot grant another hotel's membership.
- Multiple attempts to accept the same token are serialized with a database row lock. A used/revoked/expired token is rejected with HTTP 422.
- Delivery exceptions mark the issued link revoked and return HTTP 503 (a log transport is not equivalent to successful real email delivery).
- The invitation list, returned JSON and staff membership audit history do not include invite tokens.
- Possession of the invitation link is security-sensitive. Use HTTPS and avoid recording the query string in edge/access logs, third-party analytics, referrers or screenshots.
- Repeated staff invitations, accepted users and authorization scopes must be tested on both MySQL and PostgreSQL before deployment.
- Existing staff session rules, room permissions, booking-policy gates, and mock Reservation/Front Desk/Billing/Reports behavior remain unchanged.

**Important limitation:** The staff audit event stores the *inviting administrator* as the actor for the newly accepted membership; it is not an interactive action by that administrator at redemption time.

## Testing and running

Backend:

```powershell
git pull origin main
php artisan migrate
php artisan optimize:clear
php artisan test
php artisan serve
```

Frontend:

```powershell
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

Open the live **Hotel staff** page, send an invite for a new email, retrieve the local link from the Laravel log, follow the link in a clean browser, set a compliant password, sign in and confirm the correct selected hotel and role. Try reusing the link; it must fail. Also test revocation, expiry, duplicate account email and an invitation for a different hotel.

Backend tests: `tests/Feature/StaffInvitationTest.php`; frontend transport tests: `src/api/staffInvitations.test.ts`.

Source has been published to GitHub. CI, real SMTP delivery, browser acceptance and database-specific concurrency tests must be verified before a production rollout.

## Next possible milestone

Improve invitation resend and operational onboarding (email-verified existing-user invites and a mail-delivery status queue), enforce a global account/security audit trail, and prepare real transactional reservation business policies before enabling any booking writes.
