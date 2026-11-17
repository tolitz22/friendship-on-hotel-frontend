# Room Inventory: Checkout Cleaning Visibility

The Room Inventory catalogue now displays independent **PMS occupancy** and **housekeeping readiness** for managers and front-desk staff, without introducing a new editable room status.

### Staff workflow

1. **Guest still checked in:** `Occupied in PMS`; on the booked departure date, `Due for checkout today`.
2. **Guest actually checked out:** `Vacant in PMS` plus `Checkout cleaning required`. The existing checkout-linked housekeeping task appears on the room card.
3. **Housekeeping starts work:** `Cleaning in progress`.
4. **Housekeeping marks completed:** `Cleaned · awaiting inspection`. The card displays completion time and the staff member who completed the task.
5. **Authorized inspection submitted:** manager review remains required.
6. **An independent manager approves:** a vacant room shows `Ready for check-in` when no active blocker or stale inspection exists. The card displays inspection and reviewing staff names/times.

The room card has **Open checkout cleaning task** (direct link to `/housekeeping?task=…`) and **Inspect room readiness**. The cleaning/inspection windows themselves are existing PMS modules with their own permissions, revision checks, and audit trail.

### Security and operational boundaries

- The read-only API `GET /api/v1/hotels/{hotel}/room-inventory-status?room_ids=...` accepts 1–100 exact hotel room IDs from the currently paged catalogue. Laravel requires active hotel `reservation.read` permission; housekeeping uses its separately scoped task view.
- No guest identities, payments, actual door unlocks, or physical occupancy observations are inferred from this report. **Vacant in PMS** means no registered checked-in stay, not proof of an empty room.
- The dashboard counts only rooms **visible on the current catalogue page**; never call them hotel-wide totals.
- Room condition values are **computed** from the existing turnover task and latest valid readiness inspection; no new field can be toggled to fake room readiness.
- A completed cleaning task cannot independently mark a room ready. When the hotel policy enforces readiness, Laravel performs the authoritative inspection/blocker check again during check-in.
- Inventory blocks, maintenance work, new housekeeping work, or newer turnover invalidate prior readiness as appropriate.
- Every linked task is hotel-scoped. Cleaning and inspection events retain their original staff actor IDs and timestamps.

### Validation

Frontend: `npm test`, `npm run build`.
Backend: `php artisan test --filter=RoomInventoryCheckoutCleaningTest`, `php artisan test`.

Roll out the backend endpoint before deploying the frontend. Existing keycard/CCTV modules remain hidden/deferred.
