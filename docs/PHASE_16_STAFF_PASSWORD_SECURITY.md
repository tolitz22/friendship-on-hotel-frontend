# Phase 16 — Staff password recovery and account security

## What is live

The current Laravel Sanctum bearer-token development authentication now includes password management.

**Unauthenticated:** POST `/api/v1/auth/forgot-password` accepts an email, sends a Laravel password-broker link if an active account exists, and always returns the same generic response for valid email inputs. POST `/api/v1/auth/reset-password` consumes the signed reset token (sent as an opaque random token by email) with a confirmed new password and invalidates **all existing Sanctum tokens**.

**Authenticated:** POST `/api/v1/auth/change-password` requires the current password and a confirmed replacement; it invalidates all Sanctum tokens on success. The React application clears its in-memory session and returns the user to sign-in.

All three endpoints are rate-limited using `throttle:5,1` in addition to Laravel's password broker reset-link throttling. The broker stores hashed reset tokens in the pre-existing `password_reset_tokens` table. Reset links expire after **60 minutes** (see `config/auth.php`).

The password validation rule requires **at least 12 characters, uppercase and lowercase characters, and numbers**, plus matching confirmation. A signed-in password change also requires a valid current password and a different replacement.

Reset tokens are **never returned in the API response**. The user model sends the built-in broker notification through `StaffPasswordResetNotification`, which uses a configured trusted frontend URL, not a caller-specified redirect. The reset screen removes the token from the address bar/browser history after capturing it; the frontend HTML sets `referrer=no-referrer`.

## API payloads

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{"email":"staff@example.com"}
```

```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "email":"staff@example.com",
  "token":"TOKEN_FROM_EMAIL",
  "password":"NewStrongPassword123!",
  "password_confirmation":"NewStrongPassword123!"
}
```

```http
POST /api/v1/auth/change-password
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "currentPassword":"OldStrongPassword123!",
  "password":"NewStrongPassword123!",
  "password_confirmation":"NewStrongPassword123!"
}
```

Requests with invalid or expired reset tokens receive HTTP 422. Password-change attempts with wrong current passwords or invalid replacements also receive 422. Reset email requests do not indicate whether an account exists or was throttled, and email-send failures are logged rather than exposing account existence.

## React UI

In `VITE_DATA_SOURCE=api`:
- The sign-in page includes **Forgot your password?**
- `/forgot-password` requests recovery instructions
- `/reset-password?token=...&email=...` accepts the one-use emailed link
- Authenticated users can open **Change password** from the sidebar; successful change signs them out

No part of the reset form silently switches to mock data. The earlier in-memory bearer-token login continues to work. Refreshing the browser still clears the session: **this is NOT the production Sanctum SPA cookie migration**.

## Email configuration

Backend `config/mail.php` includes `log`, `array` (tests), and `smtp` transports. Backend `.env.example` now documents:

```dotenv
MAIL_MAILER=log
MAIL_FROM_ADDRESS=no-reply@example.test
MAIL_FROM_NAME="Friendship On Hotel"
STAFF_PASSWORD_RESET_URL=http://localhost:5173/reset-password
```

With `MAIL_MAILER=log` (development only), reset emails are **written to Laravel's configured log**, usually `storage/logs/laravel.log`, instead of being sent externally. Use that log to copy the local reset URL.

**Before production use**, set `MAIL_MAILER=smtp`, a verified mail provider, valid `MAIL_FROM_ADDRESS`, and a trusted **HTTPS** `STAFF_PASSWORD_RESET_URL`. Configure SPF/DKIM/DMARC and test actual delivery. Do not run `MAIL_MAILER=log` where real user reset links could enter general logs. Never expose a password reset URL or SMTP credentials in frontend env variables.

Production reset links must serve the React application and must not redirect to untrusted origins. Deployments must prevent the browser/edge access logs from capturing reset-link query strings. Consider a policy for automatic password-reset expiry and security notifications.

## Verification

Backend:

```powershell
git pull origin main
php artisan optimize:clear
php artisan test
php artisan route:list --path=api
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

There is **no new migration** in Phase 16; the existing Laravel users, personal access tokens, and password reset tables are reused. Ensure prior migrations have been applied.

Tests: `tests/Feature/StaffPasswordSecurityTest.php` validates generic recovery responses, notification dispatch, invalid and valid resets, inactive-account rejection, confirmation/current-password checks, and API-token revocation. `src/api/staffPassword.test.ts` checks unauthenticated requests, authenticated changes, request payloads and error propagation.

The source has been published to GitHub; a green build, email deliverability, HTTPS setup, and end-to-end cross-browser security testing must be verified separately before production use.

## Important security limitations and follow-up

Phase 16 implements password management and basic account recovery. It **does not yet** implement:
- First-party **HttpOnly cookie SPA sessions**, CSRF/credentialed CORS setup, and session hardening
- Secure invite/registration with one-time acceptance tokens and a complete email verification workflow
- An enforced password-reset-on-first-login requirement for CLI-created accounts
- MFA, advanced account lockout, breach screening, audit/alerting of password changes, or device/session inventory

Laravel's current bearer token is held in browser module memory rather than localStorage; token expiration defaults to 480 minutes. Switching the browser to cookie-auth is a distinct architecture milestone that requires correct domains, CSRF handling, credentials, session rotation, and security validation. Do not claim a production-ready staff identity system solely from these additions.

Neither password reset nor changing credentials affects booking policies, reservation inventory, room readiness, payments or operational lifecycle state.
