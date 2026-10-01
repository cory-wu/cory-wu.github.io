# Rendering budget and fog range

Date: 2026-10-01
Status: Accepted

## Context

The spec sets a budget of "< ~60 draw calls", one shadow map and a
device pixel ratio capped at 2, so the garden stays smooth on phones.
Two details of that budget were not obvious from the spec:

- With one shadow-casting directional light, three.js draws every
  shadow caster a second time into the shadow map, so
  `renderer.info.render.calls` reports roughly the main pass plus the
  casters, not the main pass alone.
- The plan's fog of `Fog(color, 40, 90)` assumed a close camera, but the
  fitted camera distance reaches 72 on tall phones (see
  `2026-10-01-perspective-camera.md`).

## Decision

- **Draw-call budget counts the main (colour) pass.** The test in
  `tests/unit/render-budget.test.ts` counts every mesh and point cloud
  of the live scene (diorama, library shed and ambient motion, with
  butterflies and fireflies counted together although only one set is
  visible at a time); a single-material mesh is one call, a
  multi-material mesh one call per geometry group. The shadow pass is
  accepted as the cost of the one shadow map the spec allows, and kept
  small separately: flat, low meshes (earth block, grass cap, courtyard
  pavers, pool rim, water) do not cast shadows, and a second test caps
  the shadow-caster calls.
- **Static same-material parts are merged** where it does not change
  the look (the soil slab with its roots, the four pool-rim kerbs).
  Current numbers: 57 main-pass calls, 40 shadow-caster calls.
- **Fog runs from 80 to 160** instead of 40 to 90, so the diorama is not
  washed out at the 72-unit phone distance; the fog then mostly tints
  the far sky rather than the island.

## Alternatives considered

- **Count `renderer.info` totals (both passes)** — honest about GPU
  work, but makes the budget depend on the time of day and shadow
  settings, and would forbid the one shadow map the spec allows.
- **Merge the hedge segments too** — saves another dozen calls, but the
  segments are separate meshes so tests can check heights, the entrance
  gap and the shed footprint; not needed while under budget.
- **Keep the plan's fog** — more haze at the default desktop zoom, but
  the island fades noticeably on tall phones.

## Consequences

Adding a landmark or an ambient effect now shows up in the budget test
at once. If phones still struggle, the next lever is the remaining
casters (the low front hedges could stop casting) or merging the hedges.
At the default zoom there is less haze than the plan intended.
