# Garden Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vite scaffold with a low-poly, orbitable three.js garden diorama whose clickable landmarks (starting with a library shed → `/writing/`) are mirrored by an accessible HTML nav, with time-of-day lighting, ambient motion, reduced-motion support, and a static fallback.

**Architecture:** Pure logic (time parsing, sky keyframes, pointer intent, camera fit, registry validation, boot mode) lives in small DOM/WebGL-free modules with Vitest unit tests. Scene modules (`stage`, `controls`, `diorama/*`, `landmarks/*`, `sky`, `ambient`, `interaction`, `nav`) each own one concern and are assembled in `src/main.ts`. Landmarks implement one interface and are listed in a registry; nothing outside the registry names a specific landmark.

**Tech Stack:** Vite 8, TypeScript 6, three 0.186 (`OrbitControls` from `three/examples/jsm/controls/OrbitControls.js`), Vitest + jsdom (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-10-01-garden-homepage-design.md`

## Global Constraints

- Static output only; Vite multi-page with entries `index.html` and `writing/index.html`. Site is a GitHub Pages user site, so `base` is `/`.
- Visual style: crisp low-poly, flat-shaded (`flatShading: true`), full resolution. No pixelation, no post-processing.
- Camera: `PerspectiveCamera`, FOV 30°, panning disabled, target at diorama center.
- Coordinate frame: grass top is `y = 0`, centered on origin, 12 × 12 units; earth block extends below. Placements are `[x, z]` on that plane.
- Landmark click navigates only if pointer moved < 5px between down and up.
- Sunrise fixed at 06:00, sunset at 19:00; sky recomputed once per minute; `?time=HH:MM` overrides, invalid values ignored.
- `prefers-reduced-motion: reduce` ⇒ no sway/shimmer/clouds/critters, lighting set once at load, no camera damping, on-demand rendering.
- Render loop pauses while `document.hidden`.
- Device pixel ratio capped at 2; one shadow map; < ~60 draw calls; < ~200 KB gzipped JS.
- Canvas is `aria-hidden="true"`; the `<nav>` of real `<a href>` links is always in the DOM.
- A single landmark's `build()` rejecting must not break the scene; its nav link stays.
- Use the three.js skills for scene work; run `web-design-guidelines` before calling the page done (CLAUDE.md).
- Commit messages: conventional commits (`feat:`, `test:`, `chore:`, `docs:`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Window resize / phone rotation mid-session** — canvas, camera aspect, and the hover label must follow; a tall phone viewport must still frame the whole diorama. (Test in Task 6: `fitDistance`; Task 6: `resize` updates aspect.)
2. **WebGL context lost after load** (GPU reset, backgrounded mobile tab) — the page should swap to the static fallback rather than show a frozen/black canvas. (Test in Task 11.)
3. **Pointer leaves the canvas while a landmark is hovered** — highlight and label must clear; a stale "Writing" label floating over the nav is the likely bug. (Test in Task 9.)
4. **Focusing a nav link when in fallback mode (no scene)** — focus handlers must no-op, not throw. (Test in Task 4.)
5. **Night lights vs. hover highlight both using emissive** — hovering the shed at night then un-hovering must leave the windows glowing. (Test in Task 9.)

---

## File Structure

```
index.html                         garden page shell (heading, description, nav, canvas host, reset button)
writing/index.html                 placeholder page
vite.config.ts                     multi-page build + vitest config
playwright.config.ts               e2e config (webServer: vite preview)
public/garden-fallback.webp        captured in Task 12
src/main.ts                        assembly (Task 11)
src/style.css                      page styles
src/garden/time.ts                 parseTimeParam, currentMinutes
src/garden/sky-keyframes.ts        SkyState, sampleSky, sunDirection
src/garden/pointer-intent.ts       isClick, tap reducer
src/garden/camera-fit.ts           camera constants, fitDistance
src/garden/boot.ts                 detectEnv, selectMode, showFallback
src/garden/nav.ts                  buildNav
src/garden/stage.ts                renderer/scene/camera/loop
src/garden/controls.ts             OrbitControls config, resetView, arrow keys
src/garden/palette.ts              shared colors + material factory
src/garden/diorama/*.ts            one builder per decorative element + index.ts
src/garden/landmarks/types.ts      Landmark, LandmarkBuild, Placement
src/garden/landmarks/library-shed.ts
src/garden/landmarks/registry.ts   placements, validatePlacements, loadLandmarks
src/garden/sky.ts                  createSky (lights, background, fog, night lights)
src/garden/ambient.ts              sway patch, water shimmer, clouds, critters
src/garden/interaction.ts          raycast, highlight, label, navigation
tests/unit/*.test.ts               Vitest
tests/e2e/*.spec.ts                Playwright
docs/decisions/2026-10-01-*.md     decision notes (Task 12)
```

---

### Task 1: Tooling and page shells

**Files:**
- Delete: `src/counter.ts`, `src/assets/` (hero.png, vite.svg, typescript.svg), `public/icons.svg`
- Create: `vite.config.ts`, `writing/index.html`, `tests/unit/smoke.test.ts`
- Modify: `index.html`, `src/main.ts` (reduce to `import './style.css'`), `src/style.css` (replace scaffold styles), `package.json`, `tsconfig.json` (`include: ["src", "tests", "vite.config.ts", "playwright.config.ts"]`)

**Interfaces:**
- Produces: DOM ids used by later tasks — `#garden` (canvas host div), `#site-nav` (`<nav aria-label="Site">` containing `<ul id="site-nav-list">`), `#landmark-label` (absolutely positioned `<div role="presentation" hidden>`), `#reset-view` (`<button type="button">Reset view</button>`), `#fallback` (`<img hidden alt="Illustration of a walled low-poly garden with a fountain, reflecting pool and library shed">` with `src="/garden-fallback.webp"`).
- Produces: npm scripts `dev`, `build`, `preview`, `test` (`vitest run`), `test:e2e` (`playwright test`).

- [ ] **Step 1:** Install dev deps: `npm i -D vitest jsdom @playwright/test && npx playwright install chromium`. Expected: exits 0.
- [ ] **Step 2:** Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2`; configure `vite.config.ts` with `test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'] }` and `build.rollupOptions.input = { main: 'index.html', writing: 'writing/index.html' }`.
- [ ] **Step 3:** Rewrite `index.html`: `<title>Cory Wu</title>`, meta description, `<h1>` "Cory Wu", one-sentence `<p class="garden-description">` ("A small walled garden. Each landmark in it leads to something I've made."), the elements listed in Interfaces, `<div id="garden" aria-hidden="true">`. `writing/index.html`: title "Writing — Cory Wu", heading, "Writing is coming soon.", link `<a href="/">Back to the garden</a>`, imports `/src/style.css`.
- [ ] **Step 4:** Run `npm test` → 1 passed; `npm run build` → exit 0 and `ls dist/writing/index.html` exists.
- [ ] **Step 5:** Commit `chore: replace scaffold with garden page shells and test tooling` (include the pending `.gitignore` change).

---

### Task 2: Time parsing and sky keyframes

**Files:**
- Create: `src/garden/time.ts`, `src/garden/sky-keyframes.ts`
- Test: `tests/unit/time.test.ts`, `tests/unit/sky-keyframes.test.ts`

**Interfaces:**
- Produces: `parseTimeParam(search: string): number | null` — minutes since midnight (0–1439) from `?time=HH:MM`; `null` for absent/invalid.
- Produces: `currentMinutes(now: Date): number`.
- Produces: `interface SkyState { sunColor: Color; sunIntensity: number; hemiSky: Color; hemiGround: Color; hemiIntensity: number; skyTop: Color; skyBottom: Color; fog: Color; nightFactor: number }` (three `Color`), `sampleSky(minutes: number): SkyState` (returns fresh objects every call), `sunDirection(minutes: number): [number, number, number]` (unit vector).

Keyframes (minute → preset). Interpolate linearly between neighbours (colors via `Color.lerpColors`), wrapping 1439 → 0:

| minute | preset |
|---|---|
| 0 | night |
| 330 | night |
| 390 | dawn |
| 600 | midday |
| 960 | midday |
| 1080 | golden |
| 1170 | night |

| preset | sunColor / int | hemiSky / hemiGround / int | skyTop / skyBottom | fog | nightFactor |
|---|---|---|---|---|---|
| night | #9fb4ff / 0.25 | #1d2a4a / #0e1220 / 0.35 | #0b1530 / #2a3358 | #1a2140 | 1 |
| dawn | #ffb38a / 1.2 | #f6c9b0 / #6b5a4a / 0.6 | #8fb7e0 / #f7c6a3 | #e9c9b6 | 0 |
| midday | #fff4e0 / 2.4 | #cfe8ff / #7a6a4f / 0.8 | #7fc4ef / #e6f3fb | #dcecf5 | 0 |
| golden | #ffaa55 / 1.6 | #f3c08a / #6a4e36 / 0.6 | #6f8fcf / #f9b67a | #efc193 | 0 |

Sun: between 360 and 1140, `t = (m − 360) / 780 · π`, direction = normalize(`[cos t, sin t, 0.45]`). Otherwise the fixed moon direction normalize(`[-0.4, 0.8, 0.3]`).

- [ ] **Step 1: Write failing tests**
  - `parseTimeParam('?time=21:30') === 1290`; `'?time=00:00' → 0`; `'?time=23:59' → 1439`; `'?time=24:00'`, `'?time=7:5'`, `'?time=ab:cd'`, `'?time='`, `''` → `null`; `'?foo=1&time=06:15' → 375`.
  - `currentMinutes(new Date(2026, 0, 1, 13, 7)) === 787`.
  - `sampleSky(750).sunIntensity === 2.4`; `sampleSky(0).nightFactor === 1`; `sampleSky(1125).nightFactor` strictly between 0 and 1; `sampleSky(1439)` ≈ `sampleSky(0)` (all numeric fields within 1e-6, colors `.equals`); mutating the returned `skyTop` doesn't change a later `sampleSky(750).skyTop`.
  - `sunDirection(750)[1] > 0.8`; `Math.abs(sunDirection(360)[1]) < 1e-6`; `sunDirection(100)` equals normalized moon vector; every result has length 1 ± 1e-6.
- [ ] **Step 2:** `npm test` → new tests FAIL (module not found).
- [ ] **Step 3:** Implement both modules per the tables. Regex for time: `^([01]\d|2[0-3]):([0-5]\d)$` via `URLSearchParams`.
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5:** Commit `feat: add time parsing and sky keyframe sampling`.

---

### Task 3: Pointer intent and camera fit

**Files:**
- Create: `src/garden/pointer-intent.ts`, `src/garden/camera-fit.ts`
- Test: `tests/unit/pointer-intent.test.ts`, `tests/unit/camera-fit.test.ts`

**Interfaces:**
- Produces: `CLICK_THRESHOLD_PX = 5`; `isClick(down: {x:number;y:number}, up: {x:number;y:number}, threshold = CLICK_THRESHOLD_PX): boolean` (strictly less than threshold).
- Produces: `type TapState = { shownId: string | null }`; `type TapAction = { kind: 'show'; id: string } | { kind: 'navigate'; id: string } | { kind: 'dismiss' } | { kind: 'none' }`; `reduceTap(state: TapState, hitId: string | null): { state: TapState; action: TapAction }` — pure, never mutates `state`.
- Produces: `CAMERA = { fov: 30, azimuth: Math.PI / 4, polar: 0.95, baseDistance: 34, minDistance: 14, maxDistance: 55, minPolar: 0.2, maxPolar: 1.2, fitRadius: 8.5 }` and `fitDistance(aspect: number): number` — distance at which a sphere of `fitRadius` fits both vertical and horizontal FOV, clamped to `[baseDistance, maxDistance]`.

- [ ] **Step 1: Write failing tests**
  - `isClick({x:0,y:0},{x:3,y:3}) === true`; `({x:0,y:0},{x:5,y:0}) === false`; `({x:10,y:10},{x:10,y:10}) === true`.
  - `reduceTap({shownId:null}, 'shed')` → action `show shed`, state `shed`; `reduceTap({shownId:'shed'}, 'shed')` → `navigate shed`; `reduceTap({shownId:'shed'}, null)` → `dismiss`, state `null`; `reduceTap({shownId:null}, null)` → `none`; `reduceTap({shownId:'a'}, 'b')` → `show b`; input state object is unchanged (`Object.freeze` it in the test).
  - `fitDistance(16/9) === 34`; `fitDistance(0.46)` > 34 and ≤ 55; `fitDistance(0.1) === 55`; `fitDistance(a)` is non-increasing as `a` grows from 0.3 to 2.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Horizontal half-FOV = `atan(tan(fov/2) · aspect)`; required distance = `fitRadius / sin(min(vHalf, hHalf))`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add pointer intent and camera fit helpers`.

---

### Task 4: Landmark types, registry, library shed, nav

**Files:**
- Create: `src/garden/palette.ts`, `src/garden/landmarks/types.ts`, `src/garden/landmarks/library-shed.ts`, `src/garden/landmarks/registry.ts`, `src/garden/nav.ts`
- Test: `tests/unit/registry.test.ts`, `tests/unit/library-shed.test.ts`, `tests/unit/nav.test.ts`

**Interfaces:**
- Produces (`types.ts`): `Landmark { id: string; label: string; href: string; build(): Promise<LandmarkBuild> }`, `LandmarkBuild { object: Object3D; nightLights?: MeshStandardMaterial[] }`, `Placement { landmark: Landmark; position: [number, number]; rotationY: number }`.
- Produces (`palette.ts`): `PALETTE` record of named hex colors (stone `#e8d9b5`, grass `#6fae4a`, soil `#8a5a36`, hedge `#3f8a3f`, cypress `#2f6b3a`, water `#5aa9d6`, lavender `#9b7fd1`, shedWall `#f1e6cc`, roof `#b5533c`, wood `#7a4a2a`, window `#ffd27a`) and `flatMaterial(color: string): MeshStandardMaterial` (`flatShading: true`, `roughness: 0.9`, `metalness: 0`).
- Produces (`library-shed.ts`): `libraryShed: Landmark` with `id 'library-shed'`, `label 'Writing'`, `href '/writing/'`. Built from primitives: walls box ~2.5×1.8×2.4, gable prism roof, door, two windows whose material is the sole entry in `nightLights` (emissive color `PALETTE.window`, `emissiveIntensity` 0 by default), a small book-stack/sign detail. Footprint fits inside 3×3. All meshes `castShadow`/`receiveShadow`.
- Produces (`registry.ts`): `placements: Placement[]` (shed at `[-3.5, -3.5]`, `rotationY: Math.PI / 4`); `validatePlacements(ps: Placement[]): string[]` (error messages; empty when valid); `loadLandmarks(ps: Placement[], log?: (msg: string, err: unknown) => void): Promise<Array<{ placement: Placement; build: LandmarkBuild }>>` — uses `Promise.allSettled`, positions/rotates each built object, logs and drops rejects.
- Produces (`nav.ts`): `buildNav(list: HTMLUListElement, ps: Placement[], hooks: { onFocus(id: string): void; onBlur(id: string): void }): HTMLAnchorElement[]` — one `<li><a href data-landmark-id>` per placement, label as text; replaces previous children.

- [ ] **Step 1: Write failing tests**
  - Registry: `validatePlacements(placements)` is `[]`; duplicate id → one message containing the id; `href: 'writing/'` or `'https://x'` → message containing `"must start with /"`; position with |x| or |z| > 6 → message containing `"outside diorama"`.
  - `loadLandmarks` with one good fake landmark and one whose `build` rejects: resolves to length 1, `log` called once with the bad id in the message; the good object's `position.x/z` and `rotation.y` match its placement.
  - Shed: `await libraryShed.build()` → `nightLights.length === 1`; bounding box (`Box3.setFromObject`) width/depth ≤ 3 and min y ≥ −0.01; every mesh material has `flatShading === true`.
  - Nav: renders one link per placement with `href '/writing/'`, text `'Writing'`, `data-landmark-id 'library-shed'`; calling twice doesn't duplicate; dispatching `focus`/`blur` on the link calls hooks with `'library-shed'`; **Review Focus 4:** with hooks that are no-ops (fallback mode), `focus` doesn't throw.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement the five files.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add landmark interface, registry, library shed and nav`.

---

### Task 5: Boot mode selection and fallback

**Files:**
- Create: `src/garden/boot.ts`
- Test: `tests/unit/boot.test.ts`

**Interfaces:**
- Produces: `type Mode = 'live' | 'reduced' | 'fallback'`; `detectEnv(win: Window): { webgl: boolean; reducedMotion: boolean }` (WebGL via `canvas.getContext('webgl2') ?? getContext('webgl')`, reduced motion via `matchMedia('(prefers-reduced-motion: reduce)')`); `selectMode(env): Mode`; `showFallback(doc: Document): void` — unhides `#fallback`, hides `#garden` and `#reset-view`, adds `body.is-fallback`.

- [ ] **Step 1: Write failing tests:** `selectMode({webgl:false, reducedMotion:false}) === 'fallback'`; `({webgl:false, reducedMotion:true}) === 'fallback'`; `({webgl:true, reducedMotion:true}) === 'reduced'`; `({webgl:true, reducedMotion:false}) === 'live'`; `detectEnv` on jsdom window (no WebGL; stub `matchMedia`) returns `webgl: false`; `showFallback` on a document built from `index.html`'s relevant markup leaves `#fallback.hidden === false`, `#garden.hidden === true`, `#site-nav` still visible; calling twice is harmless.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add boot mode selection and static fallback`.

---

### Task 6: Stage and controls

**Files:**
- Create: `src/garden/stage.ts`, `src/garden/controls.ts`
- Test: `tests/unit/controls.test.ts`, `tests/unit/stage.test.ts`

**Interfaces:**
- Consumes: `CAMERA`, `fitDistance` (Task 3).
- Produces (`stage.ts`): `createStage(host: HTMLElement, opts: { renderer?: WebGLRenderer; onDemand: boolean }): Stage` where `Stage { scene: Scene; camera: PerspectiveCamera; renderer: WebGLRenderer; requestRender(): void; onFrame(cb: (dt: number, elapsed: number) => void): void; resize(width: number, height: number): void; start(): void; stop(): void; dispose(): void }`. Renderer: antialias, `setPixelRatio(min(devicePixelRatio, 2))`, `shadowMap.enabled`, `PCFSoftShadowMap`, `outputColorSpace = SRGBColorSpace`. Continuous mode runs `requestAnimationFrame`; on-demand mode renders only after `requestRender()` (coalesced to one frame). Listens to `ResizeObserver` on host and calls `resize`; `visibilitychange` → `stop()` when hidden, `start()` when visible. `opts.renderer` exists only so tests can inject a stub.
- Produces (`controls.ts`): `createControls(camera: PerspectiveCamera, dom: HTMLElement, opts: { reducedMotion: boolean; onChange: () => void }): GardenControls` where `GardenControls { controls: OrbitControls; resetView(aspect: number): void; update(): void; dispose(): void }`. Settings: `enablePan = false`, `enableDamping = !reducedMotion`, `dampingFactor 0.08`, distances/polar limits from `CAMERA`, target `(0, 0, 0)`. `resetView` places camera at spherical (`fitDistance(aspect)`, `CAMERA.polar`, `CAMERA.azimuth`). Arrow keys rotate azimuth ±15° / polar ±8° and clamp. Listen on `window` (the canvas is `aria-hidden`, so it must not be focusable); ignore events with modifier keys or whose target is an `input`, `textarea`, `select` or `contenteditable` element.

- [ ] **Step 1: Write failing tests** (jsdom; construct `PerspectiveCamera` and a `div` — no WebGL):
  - `createControls(...)`: `controls.enablePan === false`; `minDistance 14`, `maxDistance 55`, `maxPolarAngle 1.2`; `enableDamping` true when `reducedMotion:false`, false when true.
  - `resetView(16/9)`: camera distance to origin ≈ 34 (±1e-6); `resetView(0.46)`: distance === `fitDistance(0.46)`.
  - Arrow keys (dispatched on `window`): `ArrowUp` 20 times never yields polar < 0.2; `ArrowLeft` changes azimuth by 15° (±1e-6) and calls `onChange`; `ArrowLeft` with `target` an `<input>` changes nothing.
  - Stage (stub `ResizeObserver` globally) with stub renderer `{ setPixelRatio, setSize, render, shadowMap: {}, domElement: document.createElement('canvas'), dispose }`: **Review Focus 1:** `resize(400, 800)` sets `camera.aspect === 0.5` and calls `setSize(400, 800)`; `onDemand: true` → two `requestRender()` calls in the same tick produce one `render` call after the next animation frame (use `vi.useFakeTimers` + stubbed `requestAnimationFrame`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add stage and orbit controls`.

---

### Task 7: Diorama — ground, walls, water

**Files:**
- Create: `src/garden/diorama/earth.ts`, `hedges.ts`, `courtyard.ts`, `pool.ts`, `fountain.ts`, `index.ts`
- Test: `tests/unit/diorama.test.ts`

**Interfaces:**
- Consumes: `PALETTE`, `flatMaterial` (Task 4).
- Produces: each file exports `build<Name>(): Object3D`. `fountain.ts` and `pool.ts` also export their water material via the returned object's `userData.water: MeshStandardMaterial`.
- Produces (`index.ts`): `buildDiorama(): Diorama` where `Diorama { group: Group; water: MeshStandardMaterial[]; sway: MeshStandardMaterial[]; lanterns: MeshStandardMaterial[]; fountainLight: PointLight }`. This task fills `water` and `fountainLight` (intensity 0, warm `#ffd9a0`, distance 6); `sway` and `lanterns` are empty until Task 8.

Layout (top view, origin center, +x right, +z toward the default camera):
- Earth: box 12 × 3 × 12, top at y = 0; top face grass, sides soil with a darker stone band in the lower third (two stacked boxes). Slightly irregular bottom: a few smaller soil boxes below.
- Hedges: perimeter boxes 0.6 thick; back walls (−z and −x sides) height 1.2, front walls (+z and +x) height 0.5. Segments with small gaps so they read as hedges; one gap on +z as the entrance.
- Courtyard: stone pavers (instanced, 0.9 × 0.08 × 0.9 with 0.06 gaps) covering x ∈ [−5, 1], z ∈ [−1, 5].
- Fountain at `[−2, 2]`: stacked cylinders (basin r=1.0, h=0.5; inner water disc r=0.85; pedestal r=0.2, h=0.8; top bowl r=0.45). Radial segments 12 for the low-poly look.
- Pool: stone rim and water for x ∈ [2.5, 5], z ∈ [−5, 4], water at y = 0.06.

- [ ] **Step 1: Write failing tests:** `buildDiorama()`; group bounding box x and z within [−6.01, 6.01], max y ≤ 3; count of `Mesh` + `InstancedMesh` objects (traverse) < 40; `water.length === 2`; `fountainLight.intensity === 0`; all materials have `flatShading === true`; hedges: max y of hedge meshes with center z > 5 is ≤ 0.51.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Pavers as one `InstancedMesh`. Every mesh `receiveShadow`; raised meshes also `castShadow`.
- [ ] **Step 4:** `npm test` → PASS. Then temporarily wire `src/main.ts` to `createStage` + `createControls` + a basic hemisphere/directional light + `buildDiorama().group`, run `npm run dev`, and visually confirm the ground, walls and water read correctly from the default angle (screenshot via the webapp-testing skill).
- [ ] **Step 5:** Commit `feat: add diorama ground, hedges, courtyard, fountain and pool`.

---

### Task 8: Diorama — plants and props

**Files:**
- Create: `src/garden/diorama/cypresses.ts`, `lavender.ts`, `pergola.ts`, `props.ts` (benches, potted plants), `trees.ts`, `lanterns.ts`
- Modify: `src/garden/diorama/index.ts`
- Test: extend `tests/unit/diorama.test.ts`

**Interfaces:**
- Produces: `buildDiorama()` now fills `sway` (cypress + lavender materials) and `lanterns` (lantern glass materials, `emissive #ffcf7a`, `emissiveIntensity` 0).

Layout:
- Cypresses: one `InstancedMesh` of 6 cones (r 0.35, h 2.6, 7 radial segments) along x = 1.8, z from −4.5 to 3.5, slight per-instance scale jitter (seeded, deterministic).
- Lavender: `InstancedMesh` of small purple icosahedron tufts in rows filling x ∈ [−1, 1.2], z ∈ [−5, −2] (east of the shed, west of the cypresses).
- Pergola: posts + crossbeams over x ∈ [−5, −3], z ∈ [3, 5] with flower clusters (pink/white small icosahedrons) on top.
- Props: two benches facing the fountain, four potted plants at courtyard corners.
- Trees: 2 round trees (trunk cylinder + 1–2 icosahedron canopies, canopy radius ≤ 0.6) at `[4.8, 5]` and `[−4.6, −1.2]` — inside the walls, clear of the pool and the shed footprint.
- Lanterns: 4 posts with a glass box at courtyard edges.
- Use a seeded PRNG helper (mulberry32) in `diorama/index.ts` so layout is identical every load.

- [ ] **Step 1: Write failing tests:** total `Mesh` + `InstancedMesh` count < 60 (draw-call budget proxy); `sway.length ≥ 2`; `lanterns.length ≥ 1` with `emissiveIntensity === 0`; no diorama mesh's world bounding box intersects the shed's footprint box `x ∈ [−5, −2], z ∈ [−5, −2]` except the earth/courtyard/hedge meshes (tag decorative meshes with `userData.kind` to filter); two `buildDiorama()` calls produce identical cypress instance matrices.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS; visual check in `npm run dev` from default angle and from a few orbited angles; compare against `inspiration/pixel-garden.png` for overall composition.
- [ ] **Step 5:** Commit `feat: add plants and props to diorama`.

---

### Task 9: Interaction — raycast, highlight, label

**Files:**
- Create: `src/garden/interaction.ts`
- Test: `tests/unit/interaction.test.ts`

**Interfaces:**
- Consumes: `isClick`, `reduceTap` (Task 3); `LandmarkBuild`, `Placement` (Task 4).
- Produces: `HIGHLIGHT = { color: '#ffffff', intensity: 0.25 }`; `setHighlight(build: LandmarkBuild, on: boolean): void` — for every `MeshStandardMaterial` in `build.object` **not** in `build.nightLights`, set emissive to `HIGHLIGHT.color`/`intensity` when on, to black/0 when off; night-light materials untouched.
- Produces: `projectLabel(object: Object3D, camera: Camera, width: number, height: number): { x: number; y: number; visible: boolean }` — screen position of the top of the object's bounding box; `visible` false when behind the camera.
- Produces: `createInteraction(opts: { dom: HTMLElement; camera: Camera; landmarks: Array<{ placement: Placement; build: LandmarkBuild }>; label: HTMLElement; navigate: (href: string) => void; requestRender: () => void }): Interaction` where `Interaction { highlight(id: string | null): void; updateLabel(): void; dispose(): void }`. Pointer events: mouse → hover via raycast (once per frame, `Raycaster` against landmark objects only, recursive), cursor `pointer` on hit, click navigates when `isClick`; touch (`pointerType === 'touch'`) → `reduceTap`; `pointerleave` → clear highlight and hide label. `highlight(id)` is also what nav focus calls.

- [ ] **Step 1: Write failing tests** (three objects in jsdom, no renderer):
  - `setHighlight` on the real `libraryShed.build()`: wall material emissive becomes white with intensity 0.25; window (night-light) material unchanged. **Review Focus 5:** set window `emissiveIntensity = 1` (night), highlight on then off → window still 1, wall back to 0.
  - `projectLabel` with a camera at (0, 10, 10) looking at origin and a unit box at origin: `visible === true`, `x ≈ width / 2`; same box placed behind the camera → `visible === false`.
  - `createInteraction` with the real shed placed at the origin, a real `PerspectiveCamera` at (0, 10, 10) looking at it, and `dom.getBoundingClientRect` stubbed to 800×600; dispatch pointer events at the shed's `projectLabel`-style projected center (Raycaster works without a renderer). Stub `requestAnimationFrame` to run synchronously so the once-per-frame hover raycast executes: pointerdown/up at the same point on the shed calls `navigate('/writing/')`; down then up 20px away does **not**; touch tap once → label shown, `navigate` not called; second tap → `navigate` called.
  - **Review Focus 3:** after a hover hit, dispatching `pointerleave` sets `label.hidden === true` and removes the highlight.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Label text = `placement.landmark.label`; position via `transform: translate(...)`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add landmark hover, highlight, label and click navigation`.

---

### Task 10: Sky and ambient motion

**Files:**
- Create: `src/garden/sky.ts`, `src/garden/ambient.ts`
- Test: `tests/unit/sky.test.ts`, `tests/unit/ambient.test.ts`

**Interfaces:**
- Consumes: `sampleSky`, `sunDirection` (Task 2); `Diorama` (Task 7/8); `LandmarkBuild.nightLights`.
- Produces (`sky.ts`): `createSky(scene: Scene, glow: { nightLights: MeshStandardMaterial[]; lanterns: MeshStandardMaterial[]; fountainLight: PointLight }): Sky` where `Sky { sun: DirectionalLight; hemi: HemisphereLight; apply(minutes: number): void }`. `apply` sets sun color/intensity/position (`sunDirection · 20`), hemi colors/intensity, `scene.background` to a `CanvasTexture` vertical gradient (skyTop → skyBottom, regenerated only when colors change by > 1/255), `scene.fog = Fog(fog, 40, 90)`, and every glow material's `emissiveIntensity = nightFactor · 1.2`, `fountainLight.intensity = nightFactor · 1.5`. Sun shadow: `mapSize 2048`, orthographic shadow camera bounds ±9, `bias −0.0005`.
- Produces (`ambient.ts`): `createAmbient(scene: Scene, diorama: Diorama, opts: { reducedMotion: boolean }): Ambient` where `Ambient { update(elapsed: number, nightFactor: number): void }`. Sway: `onBeforeCompile` patch on each `diorama.sway` material adding `uTime`, bending vertices by `sin(uTime·1.3 + phase) · 0.04 · height²` (phase from instance matrix translation). Water: oscillate `color` lightness ±3% and `roughness` on `diorama.water`. Clouds: 3 flat-shaded icosahedron clusters at y ≈ 7 drifting +x at 0.3 units/s, wrapping via `wrapCloud(x: number, span = 30): number` (exported, maps to [−15, 15)). Critters: 3 butterflies (two-plane wings flapping) orbiting the lavender bed when `nightFactor < 0.5`; 12 firefly points around the garden when ≥ 0.5. Reduced motion: nothing is added to the scene and `update` is a no-op.

- [ ] **Step 1: Write failing tests:**
  - `apply(750)`: `sun.intensity === 2.4`; all glow `emissiveIntensity === 0`; `apply(0)`: glow `emissiveIntensity ≈ 1.2`, `fountainLight.intensity ≈ 1.5`; `scene.fog` is a `Fog`; `sun.castShadow === true`.
  - `wrapCloud(15.1) ≈ −14.9`; `wrapCloud(−15.2) ≈ 14.8`; `wrapCloud(3) === 3`.
  - `createAmbient(... { reducedMotion: true })`: scene child count unchanged; `update` doesn't change any material uniform/value. `reducedMotion: false`: scene gains a clouds group; `update(10, 0)` moves cloud x.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement (see threejs-shaders / threejs-lighting skills for the `onBeforeCompile` and shadow setup).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add time-of-day sky and ambient motion`.

---

### Task 11: Assembly in `main.ts`

**Files:**
- Modify: `src/main.ts`, `src/style.css`
- Test: `tests/unit/main.test.ts` (only the exported `startGarden` wiring that doesn't need WebGL), `tests/e2e/garden.spec.ts` (first slice)

**Interfaces:**
- Consumes: everything above.
- Produces: `startGarden(win: Window, deps?: { createRenderer?: () => WebGLRenderer }): Promise<{ mode: Mode }>`, called from module top level.

Flow: `detectEnv` → `selectMode`. `buildNav` always runs first (hooks call `interaction?.highlight` or no-op). `'fallback'` → `showFallback`, done. Otherwise wrap scene setup in try/catch (failure → `showFallback`): create stage (`onDemand: mode === 'reduced'`), controls, `resetView(aspect)`, diorama, `validatePlacements` (log errors via `console.error`, continue), `loadLandmarks`, sky, ambient, interaction. Time: `parseTimeParam(location.search) ?? currentMinutes(new Date())`; `'live'` re-applies each minute (`setInterval` 60 000) unless `?time` was given; `'reduced'` applies once. Frame callback: `controls.update()`, `ambient.update`, `interaction.updateLabel()`. Reset button → `resetView` + `requestRender`. Canvas fades in: add `.is-ready` to `#garden` after the first render (CSS opacity transition 400ms, none under reduced motion). **Review Focus 2:** listen for `webglcontextlost` on the canvas → `stage.stop()` and `showFallback`.

Styles: full-viewport canvas host; nav panel bottom-left on a translucent card (readable over both day and night skies); visible focus rings; label as a small pill; reset button bottom-right; ≥ 44px touch targets; `body.is-fallback` shows the image with `object-fit: cover`.

- [ ] **Step 1: Write failing tests:**
  - Unit: `startGarden` in jsdom (no WebGL) resolves `{ mode: 'fallback' }`, nav has one link, `#fallback` visible. With `createRenderer` that throws → `{ mode: 'fallback' }` and nav intact.
  - E2E (`playwright.config.ts`: `webServer: npm run build && npm run preview -- --port 4173`, `baseURL http://localhost:4173`, chromium): page has no console errors; `#site-nav a[href="/writing/"]` visible with text "Writing"; clicking it lands on a page whose `h1` is "Writing"; `canvas` exists inside `#garden` and `#garden` gets `.is-ready`; **Review Focus 2:** `page.evaluate` → `canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` → `#fallback` becomes visible.
- [ ] **Step 2:** `npm test` and `npm run test:e2e` → new tests FAIL.
- [ ] **Step 3:** Implement `startGarden` and styles.
- [ ] **Step 4:** Both suites PASS; `npm run build` exits 0; check gzipped JS size in build output < ~200 KB.
- [ ] **Step 5:** Commit `feat: assemble garden homepage`.

---

### Task 12: End-to-end coverage, fallback image, decisions, guidelines pass

**Files:**
- Create: `tests/e2e/landmark.spec.ts`, `tests/e2e/modes.spec.ts`, `tests/e2e/capture-fallback.ts`, `public/garden-fallback.webp`, `docs/decisions/2026-10-01-low-poly-over-pixel-art.md`, `docs/decisions/2026-10-01-perspective-camera.md`, `docs/decisions/2026-10-01-code-built-geometry.md`, `docs/decisions/2026-10-01-fixed-sun-hours.md`
- Modify: `src/main.ts` — expose `window.__garden = { landmarkScreenPosition(id: string): { x: number; y: number } | null }` only when `import.meta.env.DEV || location.search.includes('e2e')`.

- [ ] **Step 1: Write e2e tests:**
  - `landmark.spec.ts`: load `/?time=12:00&e2e`, wait for `.is-ready`, get shed screen position from `__garden`, mouse move there → `#landmark-label` visible with text "Writing" and canvas cursor `pointer`; click → URL ends `/writing/`. Drag from the shed 80px left with mouse down → URL unchanged.
  - `modes.spec.ts`: context with `reducedMotion: 'reduce'` → two screenshots 1s apart are pixel-identical (`toEqual` on buffers). Launch with `--disable-webgl` / `--disable-3d-apis` → `#fallback` visible, nav link works. Viewport 390×844 → shed position is inside the viewport.
  - Screenshots for review saved to `test-results/` at `?time=06:30`, `12:00`, `18:00`, `22:00`.
- [ ] **Step 2:** `npm run test:e2e` → PASS (fix code, not tests, if anything fails).
- [ ] **Step 3:** Run `tests/e2e/capture-fallback.ts` (Playwright script: 1600×1000, `?time=12:00&e2e`, screenshot `#garden` → convert to webp with `sharp` if available, otherwise save as PNG and update `#fallback` `src` accordingly). Check file < 300 KB.
- [ ] **Step 4:** Write the four decision notes (context, decision, alternatives considered, consequences — a few sentences each, from the spec's "Decision notes to record").
- [ ] **Step 5:** Run the `web-design-guidelines` skill on `index.html`, `src/style.css`, `writing/index.html`; fix findings; rerun `npm test && npm run test:e2e`.
- [ ] **Step 6:** Commit `test: add e2e coverage, fallback image and decision notes`.
