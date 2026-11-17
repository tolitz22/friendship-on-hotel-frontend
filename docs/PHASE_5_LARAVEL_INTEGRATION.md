# Phase 5 — Laravel staff sign-in, hotel selection and live Guests

## Scope and continuity

Frontend remains React/Vite/TanStack. All existing screens were preserved. Only **Guests** is connected to Laravel when `VITE_DATA_SOURCE=api`. All other modules continue using clearly labeled, explicit mock adapters because their backend contracts have not been implemented. **API failures in Guests are never silently replaced by fixture records.**

The last *fully mock* frontend milestone was Hotel Settings & Configuration; Phase 5 is the first partial live integration.

## Switch on the integration

1. Start the Laravel backend and ensure migrations/guest migration are applied.
2. Create a hotel and staff admin account in the backend using console commands if needed.
3. In the frontend's `.env`:

```dotenv
VITE_DATA_SOURCE=api
VITE_API_URL=http://localhost:8000/api/v1
```

4. Run `npm install` and `npm run dev`, generally at `http://localhost:5173`.
5. Sign in using your provisioned Laravel staff credentials.
6. If your account belongs to multiple properties, pick one. If there is only one, it is selected automatically.
7. Open **Guests** for Laravel-backed search/list and, if you are a hotel admin, create/edit guest profiles.

You can return to `VITE_DATA_SOURCE=mock` for a fully self-contained frontend preview. Restart Vite after editing its environment settings.

## Authentication design: development-only memory token

- Uses backend `POST /api/v1/auth/login` to receive a Sanctum bearer token.
- Reads `GET /api/v1/auth/me` to retrieve current staff details and active hotel memberships.
- Stores the bearer token **in JavaScript module memory only**; never `localStorage`, `sessionStorage` or a cookie.
- A page reload clears the token and requires signing in again; this is intentional.
- Uses `Authorization: Bearer ...` on protected requests.
- Sign-out calls `POST /api/v1/auth/logout`, then clears all local session and TanStack Query caches.
- A failed sign-out request still clears the browser token, but a server-side token may remain valid until expiry; treat this as a development limitation.
- HTTPS is mandatory outside localhost. Do not treat the memory-token flow as final production browser authentication. Before production, prefer vetted Sanctum stateful cookie/CSRF authentication or a secure backend-for-frontend session and conduct a security review.

No credentials or hotel selection are persisted across reloads.

## Guest routes

| Frontend operation | Laravel endpoint |
| --- | --- |
| Login | `POST /auth/login` |
| Current staff + membership list | `GET /auth/me` |
| Logout | `POST /auth/logout` |
| List/search guests | `GET /hotels/{hotel}/guests?search=&page=&per_page=` |
| Create guest | `POST /hotels/{hotel}/guests` |
| Update guest | `PATCH /hotels/{hotel}/guests/{guest}` |

Base URL is `VITE_API_URL`, normally `http://localhost:8000/api/v1`.

Guest responses match the existing `Guest` interface: string identifiers, property ID, first/last names, nullable email/phone/nationality, createdAt offset timestamp.

Frontend controls are not authorization enforcement. Laravel checks active user, active hotel membership, admin role and token write ability.

## CORS

The backend `FRONTEND_ORIGINS` allows localhost:5173 and 127.0.0.1:5173 in the updated example. Make sure the frontend hostname is listed in the **backend's** actual `.env`, then run `php artisan config:clear`. The development API uses bearer headers rather than cookies or cross-origin credentials.

## Explicit mock split

In API mode `src/api/index.ts` chooses the real `listGuests` adapter and explicitly uses the mock adapter for all *other* dashboard, reservation, room inventory, front desk, billing, housekeeping, maintenance, report and settings endpoints.

This is not a general 'fallback on errors'; it is a **feature-by-feature backend migration**. The UI labels other routes `MOCK PREVIEW` and the guest route `LIVE GUESTS`.

Do not claim operational status snapshots or mock booking wizard actions affect Laravel.

## Tests and limitations

```powershell
npm run typecheck
npm run test
npm run build
```

Added `src/api/session.test.ts` and `src/api/http.test.ts` to verify credential lifetime, selected-hotel route generation, authorization headers and Laravel validation error propagation.

Remaining limitations:
- No server-rendered login, SSO, password reset, MFA, refresh token or persistent session.
- List/create/update guest profiles only; no guest deletion or merging.
- Guest mutations are restricted to hotel admins by the existing Laravel permission model.
- Guest audit logs, privacy retention and fine-grained staff permissions remain future requirements.
- Other screens remain mocks; no live reservations, financial activity or inventory allocations.

## Next milestone

Move to proper production browser session design and progressive property-scoped backend DTO integration. Do **not** develop booking creates until inventory model, holds, statuses and concurrency rules are approved.
