# Low-poly over pixel art

Date: 2026-10-01
Status: Accepted

## Context

The homepage garden is modelled on a pixel-art illustration
(`inspiration/pixel-garden.png`): a walled courtyard with a fountain,
pergola and cypress-lined pool. Recreating that look in three.js (low
render resolution, nearest-neighbour upscale, palette quantisation) was
explored first. The garden is also meant to be orbited and zoomed freely,
and pixel art only holds up from a fixed, carefully composed viewpoint:
once the camera turns, pixels shimmer and crawl, and zoom changes the
apparent pixel size.

## Decision

Render a crisp low-poly diorama at full resolution: flat-shaded
`MeshStandardMaterial` (`flatShading: true`) with a warm palette drawn
from the inspiration, no pixelation pass and no post-processing.

## Alternatives considered

- **Pixel art via a low-resolution render target** — faithful to the
  inspiration from the default view, but shimmers under orbit and needs a
  post-processing pass. Rejected because free orbit is a core interaction.
- **Pixel art with a locked camera** — keeps the look but drops orbit and
  zoom, which the spec treats as part of the experience.
- **Smooth-shaded, more realistic models** — more geometry and texture work,
  and loses the toy-diorama character the inspiration has.

## Consequences

The scene stays legible from any angle and at any zoom, and the device
pixel ratio cap (2) is the only resolution control. Flat shading keeps
geometry cheap and lets facets carry the style instead of textures. Hard
facets pair with plain `PCFShadowMap` shadows from a single directional
light; soft-shadow filtering is not needed for this look, and
`PCFSoftShadowMap` was removed in three r186 anyway. The inspiration is a
reference for layout and palette, not for rendering technique.
