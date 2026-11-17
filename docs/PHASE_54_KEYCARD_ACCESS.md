# Phase 54 — Mock Keycard Access Workflows

## Screens

The React/Vite PMS adds `/keycard-access` to the selected hotel's manager and front-desk workspaces, and a contextual **Keycard requests** link on an eligible checked-in reservation. Opening from a booking pre-fills its ID.

### Receptionist

- Record an **initial** authorization for an actual checked-in booking with an assigned room and a current stay date.
- Request a **replacement** for a lost card, or an **emergency** room-access exception. These require approval by a different manager.
- See their own requests, pending status and audit events; they cannot review or revoke authorizations.
- Stable retry IDs prevent duplicate records after uncertain network responses; editing fields starts a new submission.
- The visible status is **`authorized_mock`** or **`pending_manager`**, never "card issued".

### Manager

- See all requests for the selected property and filter pending, authorized mock, rejected and revoked.
- Independently approve/reject replacement and emergency requests with written evidence.
- Revoke a mock authorization record with a reason, without falsely claiming to revoke a physical access card.
- Inspect the actor-linked append-only event trail. An approval cannot be reviewed twice or by the requester.
- Current stay and room assignment are rechecked by Laravel on manager approval.

### Visibility and safety

- Housekeeping/maintenance cannot use these endpoints.
- All server responses are checked against the selected hotel. The keycard API Zod schema explicitly requires `provider: 'mock'` and `physicalCardEncoded: false`.
- No payment state, reservation lifecycle, guest identity, room-readiness rule, real lock/keycard device or CCTV event is modified by this screen.
- The mock reference is **not** a card credential or card serial number.
- An emergency request is **not permission to enter a room**. Staff must follow hotel emergency and privacy procedures.

## Rollout

Backend first:
```bash
php artisan migrate --force
php artisan test --filter=KeycardAuthorizationPhase54Test
php artisan test
php artisan route:list --path=api/v1/hotels
```

Frontend:
```bash
npm ci
npm test
npm run build
```

Confirm `/keycard-access` appears for front desk/admin only, room and booking values prefill correctly, manager approval cannot self-review, and physical issuance always reads false. Test cross-hotel switching and stale approvals.

The live lock integration remains **disabled**. Selecting a Philippines-available vendor and validating a local encoder, hardware/lock protocols, offline failures, and independent audit must happen before implementing actual card issuance or door control.
