# Phase 66G.4.3 — Priced date-change review

The expired confirmed booking's Modify stay dates dialog now calls the existing
POST /bookings/{booking}/dates/preview endpoint on explicit request. It shows
original/proposed room subtotals, the signed difference, proposed nightly rates,
and the backend closed-period warning. This preview does not save dates or charges
and is not a tax-inclusive bill or refund calculation.

The adapter validates the response and binds it to the selected hotel, booking,
and requested dates. Editing either date clears the previous review. An accepted
priced preview disables the existing unpriced save action; backend guards remain
authoritative. Existing unpriced date amendment remains available separately.

Next implementation: audited priced amendment commit with reviewed quote binding,
append-only financial corrections, closed-period controls and transactional tests.
Live deployment and signed-in browser acceptance must be verified separately.
