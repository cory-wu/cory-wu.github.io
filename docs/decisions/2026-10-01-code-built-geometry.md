# Code-built geometry with a glTF-capable landmark interface

Date: 2026-10-01
Status: Accepted

## Context

The garden needs an earth block, hedges, a courtyard, a fountain, a
pool, plants, props and a first landmark (the library shed), with more
landmarks added as projects are added. The assets could be authored in
a 3D tool and loaded as glTF, or built in TypeScript from three.js
primitives. The site is static, has a ~200 KB gzipped JS budget, and is
maintained by one person.

## Decision

Build everything at launch in code from three.js primitives, one
builder module per element under `src/garden/diorama/` and one module
per landmark under `src/garden/landmarks/`, using `InstancedMesh` or
merged geometry for repeated objects. Landmarks expose an async
`build(): Promise<LandmarkBuild>`, so a future landmark can load a
`.glb` without changes to the scene, interaction or nav code.

## Alternatives considered

- **Author the whole diorama in Blender and load one glTF** — easier to
  sculpt by eye, but adds a binary asset pipeline, a loader in the bundle
  and a second source of truth for placement and materials.
- **Code for the diorama, glTF only for landmarks from the start** —
  premature; the shed is simple enough to build from boxes and prisms.

## Consequences

The scene has no asset downloads beyond the JS bundle, every value
(palette, sizes, placements) lives in reviewable code, and the draw-call
budget is easy to hold. Organic shapes are limited to what primitives
can express. Because `build()` is async and failures are isolated, a
landmark whose build rejects is skipped in the scene while its nav link
stays, which also covers a future glTF that fails to load.
