# Fixed 06:00/19:00 sun hours

Date: 2026-10-01
Status: Accepted

## Context

The garden's lighting follows the visitor's local clock through dawn,
midday, golden hour and night keyframes. Real sunrise and sunset vary by
latitude and season, and computing them needs the visitor's location,
from the Geolocation API (a permission prompt) or an IP lookup (a
network request and a third party), on a site that is otherwise static.

## Decision

Fix sunrise at 06:00 and sunset at 19:00 local time for everyone. The
sun follows a fixed arc between them, the four keyframes interpolate
(wrapping across midnight), the sky is recomputed once per minute, and
`?time=HH:MM` forces a time for debugging and screenshots (invalid
values are ignored).

## Alternatives considered

- **Geolocated sunrise/sunset** — accurate, but asks for location for a
  purely decorative effect, or depends on an external service.
- **Timezone-based approximation** — no prompt, but still wrong for much
  of each timezone and adds a solar-position calculation for little gain.
- **Static midday lighting** — simplest, but loses the time-of-day
  atmosphere that makes return visits feel different.

## Consequences

Lighting is deterministic and private: no permission prompt, no network
call, and the same local time always looks the same, which keeps the
`?time=` screenshots and the noon fallback capture reproducible. Visitors
far from these hours (high latitudes, summer evenings) will see a sky
that does not match their window. Under reduced motion the lighting is
set once at load rather than every minute.
