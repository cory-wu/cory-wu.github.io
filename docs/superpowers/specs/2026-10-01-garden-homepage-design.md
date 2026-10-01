# Garden Homepage — Design

Date: 2026-10-01
Status: Draft for review

## Intent

The homepage of cory-wu.github.io is a small three.js garden: a walled,
low-poly diorama floating on a block of earth. It is primarily atmosphere,
with a few clickable **landmarks** that each lead somewhere on the site.
Landmarks map to projects; the garden grows one landmark per project over
time. The first landmark is a **library shed** that links to `/writing/`.

Inspiration: `inspiration/pixel-garden.png` (walled courtyard, fountain,
pergola, reflecting pool lined with cypresses, lavender, benches, potted
plants). The surrounding meadow from the inspiration is intentionally
excluded.

### Success criteria

- A visitor sees a recognizably "inspiration-like" garden within ~1s on
  decent hardware, can orbit and zoom it, and can reach `/writing/` either
  by clicking the shed or via an always-present HTML nav.
- Adding a new project landmark requires one new module plus one registry
  line, with no changes to scene, interaction, or nav code.
- Works without WebGL (static fallback) and respects
  `prefers-reduced-motion`.

## Decisions (summary)

| Topic | Decision |
|---|---|
| Role of garden | Hybrid: atmosphere + clickable landmarks mirrored by an HTML nav |
| Framing | Floating diorama on an earth block; no surrounding meadow |
| Visual style | Crisp low-poly, flat-shaded, full resolution (not pixel art) |
| Camera | Free orbit + zoom (clamped), perspective camera with narrow FOV (~30°) |
| Landmark click | Navigates directly to the landmark's `href` |
| Ambient | Subtle motion + time-of-day lighting from visitor's local clock |
| Geometry | Built in code from three.js primitives; landmark interface also permits loaded glTF later |
| Writeups section | Named `/writing/`; one landmark (library shed) for all writing |

## Scope

In scope:
- Garden homepage (`index.html`) and all of `src/garden/`.
- The landmark system and the library-shed landmark.
- A placeholder `/writing/index.html` page so the link resolves.
- Static fallback image and HTML nav.

Out of scope (separate specs later):
- Markdown content pipeline (`src/content/`), real writing/project pages.
- Project landmarks beyond the library shed.
- Sound, analytics.

## Architecture

### Pages

Vite multi-page build with two entries: `index.html` (garden) and
`writing/index.html` (placeholder: title, short "coming soon" note, link
home). The existing scaffold files (`src/counter.ts`, demo assets) are
removed.

### Modules (`src/garden/`)

Each module has one responsibility:

| Module | Responsibility |
|---|---|
| `boot.ts` | Detect WebGL support and `prefers-reduced-motion`; start live scene or static fallback |
| `stage.ts` | Renderer, scene, camera, resize, render loop (continuous or on-demand) |
| `controls.ts` | `OrbitControls` config: damping, zoom clamp, polar-angle clamp (camera stays above the earth block), reset view |
| `diorama/*.ts` | One file per decorative builder: earth block, hedges, courtyard, fountain, pool, cypresses, lavender, pergola, trees, lanterns, clouds, critters |
| `landmarks/types.ts` | `Landmark` / `LandmarkBuild` interfaces |
| `landmarks/library-shed.ts` | First landmark |
| `landmarks/registry.ts` | Placements: which landmarks exist, where, and their transforms |
| `interaction.ts` | Raycasting against landmarks, hover highlight, cursor, click-vs-drag, navigation |
| `nav.ts` | Generates the HTML twin nav from the registry; hover label positioning |
| `sky.ts` | Time-of-day lighting, sky gradient, fog, night lights |
| `ambient.ts` | Sway, water shimmer, cloud drift, critters |

### Landmark interface

```ts
interface Landmark {
  id: string;                        // "library-shed"
  label: string;                     // "Writing"
  href: string;                      // "/writing/"
  build(): Promise<LandmarkBuild>;   // primitives now; may load a .glb later
}

interface LandmarkBuild {
  object: THREE.Object3D;            // placed in scene and raycast
  nightLights?: THREE.Material[];    // emissive at night (e.g. shed windows)
}

// registry.ts
interface Placement {
  landmark: Landmark;
  position: [x: number, z: number];  // on the diorama's ground plane
  rotationY: number;                 // radians
}

export const placements: Placement[] = [
  { landmark: libraryShed, position: [2.5, 2.5], rotationY: 0 },
];
```

The scene code treats every landmark uniformly: places it, registers it for
raycasting, adds it to the nav, and wires its `nightLights` into `sky.ts`.
Landmarks are isolated from each other; one landmark's code never
references another.

### Camera

Perspective camera, FOV ~30°, default pose at an isometric-like angle
matching the inspiration. `OrbitControls` with:
- damping on (off under reduced motion),
- min/max distance clamped so the diorama stays framed and the camera
  can't enter objects,
- max polar angle so the camera never goes below the earth block,
- target fixed at diorama center (panning disabled),
- a "reset view" button that restores the default pose.

### Coordinate frame

World units are meters-ish. The diorama's grass top is the plane `y = 0`,
centered on the origin, roughly 12 × 12 units; the earth block extends
below it. Placement `position: [x, z]` is on this plane, relative to the
center.

## Scene contents (launch)

- Earth block: grassy top, layered soil/stone sides.
- Hedge walls on all four sides; the two walls nearest the default camera
  are lower so they don't hide the courtyard.
- Stone-paved courtyard with central fountain, flowered pergola, two
  benches, potted plants.
- Reflecting pool with stone rim, lined by a row of cypresses.
- Lavender bed, a few round trees inside the walls, lanterns.
- Library shed (only clickable landmark).
- 2–3 drifting low-poly clouds; butterflies by day, fireflies by night
  (critters are the first thing to cut if time runs short).

Style: flat-shaded `MeshStandardMaterial` (or `MeshLambertMaterial`)
with a warm palette drawn from the inspiration.

## Time of day (`sky.ts`)

- Visitor's local time maps to a sun position along a fixed arc.
  Sunrise is fixed at 06:00, sunset at 19:00 (no geolocation).
- Four keyframes — dawn, midday, golden hour, night — each defining sun
  color/intensity, hemisphere/ambient light, sky gradient top/bottom
  colors, and fog tint. Values interpolate between keyframes; interpolation
  wraps across midnight.
- Night: moonlight replaces the sun; every landmark's `nightLights`,
  plus lanterns and a soft fountain point light, become emissive/lit.
- Recomputed once per minute.
- Debug override: `?time=HH:MM` forces a time. Invalid values are ignored
  (fall back to local time).
- One directional-light shadow map, frustum fitted to the diorama.

## Ambient motion (`ambient.ts`)

- Cypress and lavender sway via a vertex-shader patch
  (`onBeforeCompile`), height-weighted, with a per-instance phase.
- Fountain basin and pool water: slow shimmer via animated normal/color.
- Clouds drift on a looping path above the island and wrap around.
- Critters: a couple of butterflies near the lavender by day, fireflies at
  night.

### Reduced motion

When `prefers-reduced-motion: reduce` is set:
- sway, shimmer, clouds, and critters are disabled;
- lighting is set to the current time once at load (no per-minute updates);
- camera damping is disabled;
- the scene renders on demand (only when controls change or on resize).

The render loop also pauses whenever the tab is hidden.

## Interaction (`interaction.ts`)

- Raycast only against landmark objects, at most once per frame, on
  pointer move.
- Hover: raise emissive on the landmark's materials (no outline pass),
  set `cursor: pointer`, show an HTML label tracking the landmark's
  projected screen position.
- Click: navigate to `href` only if pointer moved < 5px between down and
  up, so orbit drags never trigger navigation.
- Touch: first tap on a landmark shows its label; a second tap on the same
  landmark navigates. Tapping elsewhere dismisses the label. Pinch zooms,
  drag orbits.

## Accessibility and nav (`nav.ts`)

- A real `<nav>` of `<a href>` links generated from the registry, always
  present in the DOM and visible as a small styled list in a corner, with
  site title / name.
- Focusing a nav link applies the same highlight to its landmark in the
  scene; Enter follows the link normally.
- The canvas is `aria-hidden="true"`. The page provides a heading (name),
  a one-sentence text description of the garden, and the nav.
- Reset-view button is a real `<button>`. Arrow keys orbit when the canvas
  is focused.

## Fallback and errors (`boot.ts`)

- No WebGL, or scene initialization throws: show
  `public/garden-fallback.webp` (a pre-rendered capture at `?time=12:00`)
  behind the same HTML nav.
- If a single landmark's `build()` rejects: log the error, skip that
  landmark in the scene, keep its nav link.
- Loading: nav renders immediately from HTML; the canvas fades in after the
  first frame renders.

## Performance

- Repeated objects (cypresses, lavender tufts, paving stones, hedge
  segments) use `InstancedMesh` or merged static geometry per material.
  Target: < ~60 draw calls.
- Device pixel ratio capped at 2. One shadow map. No post-processing.
- Budgets: < ~200 KB gzipped JS; 60fps on a mid-range laptop; smooth on a
  recent phone.

## Testing

Unit (Vitest), for logic that doesn't require WebGL:
- time → keyframe interpolation, including midnight wrap;
- `?time=` parsing, including invalid input;
- registry validation (unique ids, `href` starts with `/`);
- click-vs-drag threshold;
- nav generation from the registry;
- `boot.ts` path selection (WebGL present/absent, reduced motion).

E2E (Playwright, via the webapp-testing skill):
- page loads with no console errors;
- nav links present and resolve to `/writing/`;
- clicking the shed's projected screen position navigates to `/writing/`;
- WebGL disabled → fallback image and nav shown;
- reduced motion → no continuous animation;
- screenshots at dawn, noon, dusk, night via `?time=` for visual review.

Before calling the page done: run the `web-design-guidelines` skill.

## Decision notes to record

Add dated notes under `docs/decisions/` for:
- low-poly over pixel art (pixel art was explored and rejected in favor of
  free orbit, which pixel art handles poorly);
- perspective (narrow FOV) over orthographic camera;
- code-built geometry with a glTF-capable landmark interface;
- fixed 06:00/19:00 sun hours instead of geolocated sunrise/sunset.
