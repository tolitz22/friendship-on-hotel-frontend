# Friendship On Hotel — Design System

## Brand
Brand from uploaded hotel logo: charcoal, orange, white. The circular, detailed logo should be used at suitable size (login screen, about panel). A compact wordmark is appropriate in navigation.

## Modes
Both light and dark. Follow system preference on first visit and persist manual choice in `foh-theme`.

| Token | Light | Dark |
| --- | --- | --- |
| Canvas | #F7F8FA | #101216 |
| Surface | #FFFFFF | #1B1E24 |
| Sidebar | #222326 | #17191E |
| Primary brand | #F28C00 | #FFAA30 |
| Text | #222326 | #F3F4F6 |
| Muted text | #667085 | #A8ADB6 |
| Border | #E5E7EB | #343A44 |

Use semantic tokens and enough accessible text contrast. Orange is an accent, not a universal warning status.

## Components
Sidebar/navigation, responsive header, summary cards, status tags, forms, data tables, reservation timeline, room cards, empty/loading/error states. Use clearly labeled status text.

## Operational status dimensions
Reservation, physical occupancy, housekeeping condition, maintenance and saleable inventory are **not** a single field.

## UX
Keyboard accessible controls, labels for inputs, strong focus outlines, suitable contrast, mobile navigation, consistent spacing. No real financial actions or guest data in the prototype.

## Repo-specific note
Original uploaded circular PNG logo is included in the downloadable frontend ZIP. Copy to `public/logo.png` once you clone this repo; the current GitHub version uses an abbreviated text fallback.
