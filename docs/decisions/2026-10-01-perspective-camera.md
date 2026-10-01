# Perspective camera with a narrow FOV

Date: 2026-10-01
Status: Accepted

## Context

Diorama scenes are often drawn with an orthographic camera, which gives
the flat, isometric look of the inspiration image. The garden, however,
is orbited and zoomed by the visitor, and the camera has to keep the
whole island framed on screens from wide desktops to tall phones.

## Decision

Use a `PerspectiveCamera` with a 30° vertical FOV, placed at an
isometric-like default pose and driven by `OrbitControls` with the
target fixed at the diorama centre, panning disabled, distance and polar
angle clamped, and a "Reset view" button. On load and reset the distance
is fitted to the viewport aspect so a sphere around the island fits both
axes.

## Alternatives considered

- **Orthographic camera** — closest to the isometric illustration, but
  zoom becomes a frustum-size change rather than a dolly, orbiting reads
  as flat rotation with no depth cue, and distance fog loses its
  meaning.
- **Wide (45–60°) perspective** — the three.js default; distorts the
  hedge walls and earth block noticeably at the diorama's close framing.

## Consequences

The narrow FOV keeps lines close to parallel, so the default view still
reads as near-isometric, while orbit and zoom keep real depth. The cost
is that the camera sits far from the island, so the distance limits
matter: the maximum distance was raised from 55 to 72 so that tall phones
(aspect around 0.46) can fit the whole diorama without the fit being
clamped. Arrow keys orbit when the canvas is focused, and damping is
turned off under reduced motion.
