# Phase 17 — Opt-in Sanctum SPA session authentication

## Objective and scope

Phase 17 adds a **cookie-based first-party SPA authentication path** to the Laravel 12 + React/Vite PMS. The existing memory-only Sanctum bearer-token development mode is preserved as the **default**. Cookie mode is opt-in and requires coordinated backend, frontend, CORS, cookie, TLS and domain configuration.

This phase covers:
- Laravel first-party SPA middleware (`statefulApi()`) and a strict configured stateful-origin list
- Session-backed login at `POST /api/v1/auth/spa-login`, using Laravel's `web` guard and **regenerating the session ID**
- Session-backed logout at `POST /api/v1/auth/spa-logout`, invalidating the current session and regenerating its CSRF token
- Reuse of `GET /api/v1/auth/me` and all existing `auth:sanctum` hotel-scoped routes without a bearer token
- Fetch-based `GET /sanctum/csrf-cookie` bootstrap, `credentials:'include'`, and decoded `X-XSRF-TOKEN` headers for writes
- Session restoration from `/auth/me` after a full browser reload, without `localStorage` or readable bearer credentials
- Clearing the client session state on authenticated cookie-request HTTP 401 / 419
- CSRF initialization before unauthenticated password-reset form submissions
- Retaining the original dev bearer-token mode as a rollback option

**Status:** source committed; this is **not a claim of verified production security** or passing multi-browser tests. Keep the feature disabled until deployment testing succeeds.

## Local setup (single hostname, different ports)

Use **localhost for both applications**, not a mixture of `localhost` and `127.0.0.1`.

Laravel `.env`:

```dotenv
APP_URL=http://localhost:8000
SPA_SESSION_ENABLED=true
SANCTUM_STATEFUL_DOMAINS=localhost:5173
FRONTEND_ORIGINS=http://localhost:5173
SESSION_DRIVER=file
SESSION_DOMAIN=
SESSION_SECURE_COOKIE=false
SESSION_SAME_SITE=lax
SESSION_LIFETIME=120
```

React/Vite `.env`:

```dotenv
VITE_DATA_SOURCE=api
VITE_AUTH_MODE=cookie
VITE_API_URL=http://localhost:8000/api/v1
```

Restart Laravel/Vite after changing their environment variables and run `php artisan optimize:clear`. The default backend `SPA_SESSION_ENABLED=false` keeps the earlier bearer API unmodified. The default frontend `VITE_AUTH_MODE=bearer` keeps legacy development login and memory-only tokens.

In cookie mode, a signed-in browser uses an **HttpOnly Laravel session cookie**, not an access token in JS. The separate non-HttpOnly `XSRF-TOKEN` cookie is intentionally readable so fetch can send it in an `X-XSRF-TOKEN` header. This cookie is **not the authentication credential**.

The React client reads the XSRF token from `document.cookie`, URL-decodes it, and sends it on POST/PATCH. On `/auth/spa-login`, the server creates a session and returns `authenticated:true`, `authMode:'cookie'`, and a user profile **without a bearer token**.

## First-party and production domain requirements

Laravel Sanctum SPA cookie sessions require the SPA and API to share the **same registrable top-level domain**. For example:

- Frontend: `https://pms.example.com`
- Backend: `https://api.example.com`

Then configure:

```dotenv
APP_URL=https://api.example.com
SPA_SESSION_ENABLED=true
SANCTUM_STATEFUL_DOMAINS=pms.example.com
FRONTEND_ORIGINS=https://pms.example.com
SESSION_DOMAIN=.example.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SESSION_DRIVER=redis
```

React:

```dotenv
VITE_DATA_SOURCE=api
VITE_AUTH_MODE=cookie
VITE_API_URL=https://api.example.com/api/v1
```

**Do not use a frontend on an unrelated hosted domain and an API on a different registrable domain** and expect this first-party cookie model to work. Add custom domains or a same-site reverse proxy first.

Use valid HTTPS, a trusted reverse-proxy configuration, exact allowed origins (not wildcard CORS with credentials), secure/HttpOnly session cookies, a persistent shared session store across replicas, and verified CSRF behavior. If using Redis, configure the required driver and connection first; a session store alone does not configure itself. Never deploy `SESSION_SECURE_COOKIE=false` on HTTPS production.

`SANCTUM_STATEFUL_DOMAINS` values have **hostnames and optional ports but no scheme**. `FRONTEND_ORIGINS` values have **scheme, hostname and optional port**. Production reverse proxies must forward HTTPS host/protocol correctly.

## Routes

```http
GET  /sanctum/csrf-cookie
POST /api/v1/auth/spa-login
POST /api/v1/auth/spa-logout
GET  /api/v1/auth/me
```

`spa-login` requires `SPA_SESSION_ENABLED=true` **and** a request for which Sanctum's trusted frontend middleware started a Laravel session; it otherwise rejects with 403. Incorrect login credentials return validation errors. `spa-logout` requires an authenticated first-party session and invalidates it.

Other PMS routes are unchanged. `auth:sanctum` recognizes first-party cookie auth and bearer auth; existing hotel membership/role middleware still enforce hotel isolation. Sanctum reports `tokenCan()` as true for first-party SPA requests, so **server-side hotel membership and role checks are essential** and remain in place.

The old `POST /api/v1/auth/login` and `POST /api/v1/auth/logout` bearer endpoints are retained to preserve previous development clients. If cookie mode is enabled for the SPA origin, **do not mix cookie and bearer login from that same stateful origin**: coordinate frontend mode and backend configuration.

## Browser verification checklist (required before enabling in production)

1. In a clean browser profile, sign in to the PMS while configured for cookie mode. Confirm the `/sanctum/csrf-cookie` request succeeds and then `/auth/spa-login` returns a **token-free** response.
2. In Developer Tools, confirm the Laravel session cookie is HttpOnly and the `XSRF-TOKEN` cookie is present. Confirm the frontend sends `X-XSRF-TOKEN` on POST/PATCH and `credentials:include` on all API requests.
3. Reload the browser page. `/auth/me` should restore the current hotel staff account and one-hotel selection.
4. Test admin-only and assigned-worker protected actions; verify they remain role/tenant-restricted.
5. Sign out. Confirm the session is invalidated and a fresh `/auth/me` returns HTTP 401.
6. Remove or corrupt `X-XSRF-TOKEN` on an unsafe request. Outside Laravel's test environment, CSRF middleware must reject it with **419**.
7. Simulate session expiration, password changes and server-side account deactivation; verify the app prompts sign-in and does not show a stale authenticated screen.
8. Test on real browsers, with production HTTPS, session store, reverse proxy, all frontend/API subdomains, and SMTP reset links.
9. Revert `SPA_SESSION_ENABLED=false` and `VITE_AUTH_MODE=bearer` together if rollout checks fail. Clear cookies and caches before retesting.

## Tests

Backend `tests/Feature/SpaSessionAuthenticationTest.php` covers opt-in behavior, session login without personal-access-token creation, protected access, rejected credentials, disallowed request origins, session logout, and legacy bearer login. PHP feature tests do **not** establish actual browser CSRF/header/cookie behavior; steps above are mandatory.

Frontend `src/api/spaSession.test.ts` covers CSRF initialization, credentialed GET/POST, decoded CSRF headers, token-free cookie login, forgot-password CSRF bootstrap, missing cookie errors, 401 session-expiry handling and 419 propagation.

Run:

```powershell
# Backend
git pull origin main
php artisan optimize:clear
php artisan test
php artisan route:list --path=api
php artisan serve

# Frontend
git pull origin main
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

No new migrations are included. File sessions work locally; production deployments with multiple instances require a **shared session store**, proper rotation/expiry, and a deployment-specific session persistence test.

## Security limitations and follow-up

This is a foundational, opt-in session integration, not a complete production hardening signoff.

- Laravel still exposes the earlier bearer-token login for compatibility. Restrict or remove it once clients have been migrated if it is unnecessary for production.
- Persistent sessions may outlive short-lived PATs. Enforce reasonable idle expiration, secure cookies, session store retention, and session revocation.
- Password changes invalidate the current cookie session and revoke all API tokens; other cookie sessions rely on Laravel's authenticated-session password-hash checks. Test invalidation across devices before production.
- Implement secure invitation acceptance, MFA where appropriate, device/session management, auth security telemetry, and account recovery abuse detection.
- Validate third-party embedded content, XSS protections, Content Security Policy, HTTPS, HSTS, reverse-proxy host trust and log hygiene.
- Reservation allocation, real front-desk booking operations, billing and room readiness remain separate, unapproved PMS modules.
