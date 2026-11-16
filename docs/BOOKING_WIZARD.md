# Reservation creation preview — frontend milestone

This is an interactive **mock-only** booking walkthrough, not reservation creation.

## Workflow

1. Choose an existing guest through `useGuests()`.
2. Choose hotel-local check-in/check-out, room type, adults and children.
3. Review the request and an illustrative room-only subtotal; complete the **demo preview** without saving anything.

- Form validation: React Hook Form, Zod schema in `src/features/reservations/bookingDraft.ts`.
- Guest records and room-type sample rates are obtained from typed data-source methods, not imported directly into the wizard.
- Illustrative quote: `useBookingQuote()`. In mock mode, `getBookingQuote()` returns a sample PHP room-only subtotal in minor currency units.
- Live API mode intentionally disables opening the wizard; no real reservations, holds, room assignments, charges, taxes or payments occur.
- The wizard modal can be closed and traps keyboard focus.
- A successful walkthrough intentionally **does not** append the request to the reservations list or modify any data.

## Draft fields

```typescript
type BookingQuoteRequest = {
  roomTypeId: string;
  checkIn: string; // YYYY-MM-DD, hotel local date
  checkOut: string; // exclusive YYYY-MM-DD
  adults: number;
  children: number;
};
```

## Proposed API contract (not implemented by Laravel)

`GET /api/v1/booking-drafts/options`

Returns `{ data: { roomTypes: [{ id, name, maxOccupancy, sampleNightlyRate }] } }`.

`GET /api/v1/booking-drafts/quote?room_type_id=...&check_in=...&check_out=...&adults=...&children=...`

Returns `{ data: { nights, nightlyRate, roomSubtotal, currency, isIllustrative } }`.

These are **provisional** read-only endpoints. Production pricing must use an authenticated server-authoritative quote service and may instead require a POST request once rates, discounts, taxes, channel rules and real availability are defined. Do not send PII or payment details as GET query parameters. The sample-rate field in the options response will be replaced with actual dynamic rate-plan presentation.

A future reservation mutation requires explicit business-rule approval, request authorization, inventory transaction/concurrency protection, CSRF-safe authenticated calls, idempotency safeguards, and real end-to-end tests.

## Important limitations

The demo max adult/child values and nightly prices are UI sample constraints only, **not approved hotel booking policies**.
The screen does not promise availability, that a room type can fit selected occupants, or that quoted subtotal is the final price. No actual taxes or fees are calculated.

The requested frontend milestone is complete when the walkthrough is usable in both UI themes with mock data and the API adapter types are ready for later Laravel implementation.
