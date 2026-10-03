# Site Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every non-garden page a shared "garden journal" design (fonts, tokens, prose styles, top bar and footer) with three per-page theme variables, and move the garden onto the same tokens and fonts.

**Architecture:** Plain CSS custom properties in `src/styles/` (tokens → base → prose → shell, bundled by `site.css`); the shell markup lives in `src/site/shell.html` and a pure `injectShell()` function, wired into Vite as a `transformIndexHtml` plugin, inserts it into every HTML entry except the garden. A pure contrast helper enforces WCAG AA on the tokens now and on per-page themes later.

**Tech Stack:** Vite 8, TypeScript 6, Vitest 4 (jsdom), Playwright, `@fontsource/eb-garamond`, `@fontsource/cormorant-garamond`, `@fontsource/inter` (v5), `@types/node` (dev).

**Spec:** `docs/superpowers/specs/2026-10-03-design-system-design.md`

## Global Constraints

- Light only; no dark-mode rules.
- Fonts: Cormorant Garamond 500/600, EB Garamond 400 / 400 italic / 600, Inter 500 — Latin subset only, `font-display: swap`, self-hosted from `@fontsource/*` (never Google Fonts at runtime).
- Readability: Cormorant only at ≥ 1.5rem; nothing below 0.875rem in a serif; every text colour ≥ 4.5:1 on `--paper` and `--paper-raised`; `--accent` ≥ 4.5:1 on `--paper`.
- Token values exactly as the spec's Tokens tables (colour, type, spacing).
- Per-page theme variables are exactly `--accent`, `--paper`, `--heading-font`; `--heading-font` defaults to `var(--font-display)`.
- Stylesheets are linked from HTML `<head>`, never imported from JS (commit 3e6b5c7).
- The garden (`index.html`) gets no shell; its only visual changes are fonts and token-sourced colours.
- Text pages ship no `<script>`.
- Budgets: fonts requested on a text page ≤ 150 KB; on `/` ≤ 90 KB.
- `/styleguide/` exists in `npm run dev` only (not in `build.rollupOptions.input`).
- Run the `web-design-guidelines` skill before calling the work done; record the decision note.
- Commits: conventional (`feat:`, `test:`, `docs:`, `chore:`), staged by explicit path (never `git add -A`; untracked `.claude/`, `.agents/`, `CLAUDE.md`, `skills-lock.json`, `inspiration/` are the user's), ending with the authoring model's `Co-Authored-By` trailer.

## Review Focus

1. **A page whose path is `/writing` without a trailing slash, or a nested `/writing/some-post/`** — the Writing nav item should still be marked current. (Test in Task 3.)
2. **Hard reload on a slow connection** — text must render immediately in the fallback serif and swap to EB Garamond without layout jumping wildly; `font-display: swap` plus Georgia fallbacks. (Covered by Task 5's font checks; visual review in Task 5 screenshots.)
3. **Keyboard-only visitor on `/writing/`** — first Tab lands on the visible "Skip to content" link, Enter moves focus into `#content`. (Test in Task 5.)
4. **Long unbroken content (URLs, code lines, wide tables) on a 390px phone** — no horizontal page scroll; code blocks and tables scroll inside themselves. (Test in Task 5.)
5. **Running `vite build` twice / HMR re-transforming a page** — the shell must not be inserted twice. (Test in Task 3.)

---

## File Structure

```
src/site/contrast.ts            WCAG helpers (Task 1)
src/site/shell.html             header + footer snippet, marker comments (Task 3)
src/site/shell.ts               pure injectShell(), sectionFromPath() (Task 3)
src/styles/fonts.css            @fontsource imports (Task 2)
src/styles/tokens.css           :root custom properties (Task 2)
src/styles/base.css             element defaults (Task 2)
src/styles/prose.css            .prose long-form styles (Task 2)
src/styles/shell.css            skip link, top bar, column, footer (Task 2)
src/styles/site.css             @imports fonts, tokens, base, prose, shell (Task 2)
src/styles/garden.css           migrated from src/style.css (Task 4)
styleguide/index.html           dev-only style guide (Task 5)
vite.config.ts                  + siteShell() plugin (Task 3)
writing/index.html              wrapped in shell (Task 3)
tests/unit/contrast.test.ts     (Task 1)
tests/unit/tokens.test.ts       (Task 2, extended in Task 4)
tests/unit/shell.test.ts        (Task 3)
tests/e2e/site.spec.ts          (Task 5)
docs/decisions/2026-10-03-design-system.md (Task 5)
```

---

### Task 1: Dependencies and contrast helper

**Files:**
- Modify: `package.json` (devDependencies: `@types/node`; dependencies: `@fontsource/eb-garamond`, `@fontsource/cormorant-garamond`, `@fontsource/inter`), `tsconfig.json` (`"types": ["vite/client", "node"]`)
- Create: `src/site/contrast.ts`, `tests/unit/contrast.test.ts`

**Interfaces:**
- Produces: `relativeLuminance(hex: string): number`, `contrastRatio(a: string, b: string): number`, `meetsAA(fg: string, bg: string): boolean` (`contrastRatio ≥ 4.5`). Accept `#rgb` / `#rrggbb` (case-insensitive); throw `Error` mentioning the bad input otherwise.

- [ ] **Step 1:** `npm i @fontsource/eb-garamond @fontsource/cormorant-garamond @fontsource/inter && npm i -D @types/node`. Expected: exit 0.
- [ ] **Step 2: Write failing tests:** `contrastRatio('#000', '#fff')` ≈ 21 (±0.01); `contrastRatio('#777777', '#777777') === 1`; argument order doesn't matter; `contrastRatio('#1f2a1f', '#f4f1e8')` > 12; `meetsAA('#767676', '#ffffff') === true` (4.54) and `meetsAA('#777777', '#ffffff') === false` (4.48); `#FFF` accepted; `'red'`, `'#12345'`, `''` throw.
- [ ] **Step 3:** `npx vitest run tests/unit/contrast.test.ts` → FAIL (module not found).
- [ ] **Step 4:** Implement per WCAG 2.x (sRGB channel linearisation with the 0.04045 threshold; ratio `(L1 + 0.05) / (L2 + 0.05)` with L1 the lighter).
- [ ] **Step 5:** Focused test PASS; `npm test` and `npx tsc --noEmit` clean.
- [ ] **Step 6:** Commit `feat: add WCAG contrast helper and design-system dependencies`.

---

### Task 2: Tokens and stylesheets

**Files:**
- Create: `src/styles/fonts.css`, `tokens.css`, `base.css`, `prose.css`, `shell.css`, `site.css`; `tests/unit/tokens.test.ts`

**Interfaces:**
- Consumes: `meetsAA` (Task 1).
- Produces: CSS custom properties per the spec's Tokens tables; class names the shell markup (Task 3) and pages use: `.skip-link`, `.site-bar`, `.site-title`, `.site-nav`, `.site-footer`, `.site-column` (the centred measure-width wrapper), `.prose` (on `<main id="content">`).
- Produces (test helper, in `tests/unit/tokens.test.ts`): `readStyle(name: string): string` reading `src/styles/<name>` with `node:fs`, and `parseTokens(css: string): Map<string, string>` for `--name: value` pairs in `:root`.

`fonts.css` imports exactly: `@fontsource/cormorant-garamond/latin-500.css`, `latin-600.css`; `@fontsource/eb-garamond/latin-400.css`, `latin-400-italic.css`, `latin-600.css`; `@fontsource/inter/latin-500.css`. (Fontsource v5 already sets `font-display: swap`; confirm in the installed CSS.)

- [ ] **Step 1: Write failing tests** (`tokens.test.ts`):
  - every colour token from the spec table has the exact value (`--paper #f4f1e8`, `--paper-raised #fbf8f0`, `--ink #1f2a1f`, `--ink-soft #4a564a`, `--ink-muted #6b746b`, `--accent #2f6b3a`, `--accent-2 #c8683f`); `--heading-font` is `var(--font-display)`; `--measure` is `34em`; `--space-1`…`--space-8` are the spec's rem values.
  - `meetsAA` for `--ink`, `--ink-soft`, `--ink-muted` on both `--paper` and `--paper-raised`, and `--accent` on `--paper`.
  - every `var(--x)` referenced in `base.css`, `prose.css`, `shell.css` is defined in `tokens.css` (strip fallbacks: `var(--x, …)` still requires `--x`).
  - `fonts.css` imports exactly the six files listed above and nothing else.
  - `site.css` `@import`s `fonts.css`, `tokens.css`, `base.css`, `prose.css`, `shell.css` in that order.
  - readability rule: in `prose.css`/`shell.css`, every rule whose `font-family` resolves to `--font-display` or `--heading-font` uses a font-size of `var(--text-h3)` or larger (`--text-h1`, `--text-h2`, `--text-h3`, or the site title at `1.5rem`); no rule sets a serif family together with a size below `0.875rem`. (A simple rule-block regex scan is enough; document its limits in a comment.)
- [ ] **Step 2:** `npx vitest run tests/unit/tokens.test.ts` → FAIL (files missing).
- [ ] **Step 3:** Write the six stylesheets per the spec's Stylesheets table and Tokens section. Specifics the spec leaves open, decided here:
  - `base.css`: `html { -webkit-text-size-adjust: 100%; }`; `body { margin: 0; background: var(--paper); color: var(--ink); font: var(--text-body)/1.6 var(--font-text); }`; `a { color: var(--accent); text-underline-offset: 0.18em; text-decoration-thickness: 1px; } a:hover { text-decoration-thickness: 2px; }`; `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }`; `::selection { background: color-mix(in srgb, var(--accent) 22%, transparent); }`; `[hidden] { display: none !important; }`.
  - `prose.css`: vertical rhythm via `> * + * { margin-top: var(--space-4) }` with larger space before headings (`var(--space-6)`); headings use `var(--heading-font)` weight 600; `pre { overflow-x: auto }`; tables wrapped behaviour via `display: block; overflow-x: auto` on `table`; `img, video { max-width: 100%; height: auto }`; `code` at `0.9em`; long words: `.prose { overflow-wrap: anywhere }` for links/URLs only (`.prose a { overflow-wrap: anywhere }`).
  - `shell.css`: `.site-column { max-width: var(--measure); margin-inline: auto; padding-inline: max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right)); }`; `.site-bar` is a flex row with `flex-wrap: wrap`, gap `var(--space-3)`, hairline bottom border, max-width `calc(var(--measure) + 8rem)` centred; `.site-title` `font: 600 1.5rem/1.2 var(--font-display)`; nav links `font: 500 var(--text-ui) var(--font-ui)`, `[aria-current="page"]` gets `text-decoration: underline 2px var(--accent)`; `.skip-link` visually hidden until `:focus` (then positioned top-left on `--paper-raised`); `.site-footer` `font: 500 var(--text-ui) var(--font-ui); color: var(--ink-muted)`, flex with space-between, top hairline, wraps on narrow screens.
- [ ] **Step 4:** Tests PASS; `npm test`, `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat: add design tokens and journal stylesheets`.

---

### Task 3: Shell snippet, injection plugin, `/writing/` in the shell

**Files:**
- Create: `src/site/shell.html`, `src/site/shell.ts`, `tests/unit/shell.test.ts`
- Modify: `vite.config.ts` (add `siteShell()` plugin), `writing/index.html`

**Interfaces:**
- Produces (`shell.ts`):
  - `type Section = 'garden' | 'writing'`
  - `sectionFromPath(path: string): Section | null` — `/writing`, `/writing/`, `/writing/index.html`, `/writing/anything/…` → `'writing'`; `/` and `/index.html` → `null` (the garden is never shelled); unknown → `null`.
  - `splitShell(snippet: string): { header: string; footer: string }` — the snippet holds `<!-- shell:header -->…<!-- /shell:header -->` and `<!-- shell:footer -->…<!-- /shell:footer -->`; throws if either block is missing.
  - `injectShell(html: string, opts: { header: string; footer: string; section: Section | null; year: number }): string` — inserts `header` right after the `<body…>` open tag and `footer` right before `</body>`; replaces `{{year}}` in the footer; sets `aria-current="page"` on the nav link carrying `data-section="<section>"`; returns `html` unchanged if it already contains `class="site-bar"`; throws `Error('… needs <main id="content">')` if there's no `<main` with `id="content"`.
- Produces (`vite.config.ts`): `siteShell(): Plugin` — `transformIndexHtml` handler `(html, ctx)`: skip when `ctx.path` is `/index.html` or `/`; otherwise read `src/site/shell.html` with `node:fs` (each call, so edits apply in dev), `splitShell`, and `injectShell` with `section: sectionFromPath(ctx.path)` and `year: new Date().getFullYear()`.

`shell.html` content (exact structure; copy as written):
- header block: `<a class="skip-link" href="#content">Skip to content</a>` then `<header class="site-bar"><a class="site-title" href="/">Cory Wu</a><nav class="site-nav" aria-label="Site"><a href="/" data-section="garden">Garden</a><a href="/writing/" data-section="writing">Writing</a></nav></header>`
- footer block: `<footer class="site-footer"><a href="/">← Back to the garden</a><span>© {{year}} · <a href="https://github.com/cory-wu">GitHub</a></span></footer>`

`writing/index.html` becomes: head links `/src/styles/site.css` (replacing `/src/style.css`), adds `<link rel="preload" as="font" type="font/woff2" crossorigin href="/node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2">` (verify the exact filename in the installed package); body is `<main id="content" class="prose site-column"><h1>Writing</h1><p>Writing is coming soon.</p></main>` (the old back link is now the footer's job). If, after `npm run build`, the preload `href` is not rewritten to the same hashed asset the CSS references, remove the preload and note it in the report — do not ship a preload to a 404.

- [ ] **Step 1: Write failing tests** (`shell.test.ts`, reading the real `src/site/shell.html` via `node:fs`):
  - `sectionFromPath`: the cases listed above, including `/writing` without slash and `/writing/some-post/` (Review Focus 1).
  - `splitShell` on the real snippet returns both blocks; on a snippet missing the footer markers it throws.
  - `injectShell` on `<body><main id="content"></main></body>`: output has exactly one `.skip-link`, one `.site-bar`, one `.site-footer`; the skip link precedes the header; the footer is the last element before `</body>`; Writing link has `aria-current="page"` and Garden doesn't when `section: 'writing'`; with `section: null` no `aria-current`; `{{year}}` replaced with the given year.
  - Idempotent: `injectShell(injectShell(x))` equals `injectShell(x)` (Review Focus 5).
  - Throws on HTML without `<main id="content">`.
  - `<body class="x" style="--accent:#123456">` keeps its attributes.
- [ ] **Step 2:** `npx vitest run tests/unit/shell.test.ts` → FAIL.
- [ ] **Step 3:** Implement `shell.html`, `shell.ts`, the plugin, and the new `writing/index.html`. Use string operations (no DOM parser in the config process).
- [ ] **Step 4:** Tests PASS. `npm run build` → `dist/writing/index.html` contains the shell once, `dist/index.html` contains no `site-bar`, and `dist/writing/index.html` has no `<script`. `npm test`, `npx tsc --noEmit` clean; existing e2e suites still pass (`npm run test:e2e`).
- [ ] **Step 5:** Commit `feat: inject the site shell into text pages and wrap /writing/`.

---

### Task 4: Garden adopts tokens and fonts

**Files:**
- Create: `src/styles/garden.css` (moved from `src/style.css` with `git mv`, then edited)
- Modify: `index.html` (stylesheet link → `/src/styles/garden.css`), `tests/unit/loader.test.ts` (expected stylesheet href), `tests/unit/tokens.test.ts` (include `garden.css` in the defined-variables check)
- Delete: `src/style.css`

**Interfaces:**
- Consumes: tokens and `fonts.css` (Task 2).

`garden.css` starts with `@import './fonts.css'; @import './tokens.css';` and replaces every hard-coded colour that has a token equivalent (`#f4f1e8` → `var(--paper)`, `#1f2a1f` → `var(--ink)`, `#2f6b3a` → `var(--accent)`, card border/rule → `var(--rule)`, …); colours with no token (card translucency, label background) stay as garden-local custom properties. Font changes only: name-card `h1` → `600 1.625rem/1.15 var(--font-display)` — the one allowed size change: it is 1.375rem today, below the 1.5rem Cormorant floor, and Cormorant reads optically small; `.garden-description` → `var(--font-text)`, nav links, `#reset-view`, `#landmark-label`, `#loader .loader-text` → `var(--font-ui)` 500. No other layout, size or position changes.

- [ ] **Step 1:** Update the tests first: `loader.test.ts` expects `link[rel="stylesheet"][href="/src/styles/garden.css"]`; `tokens.test.ts` adds `garden.css` to the files whose `var(--…)` must resolve (garden-local properties defined inside `garden.css` itself count as defined). Run → FAIL.
- [ ] **Step 2:** `git mv src/style.css src/styles/garden.css`; edit per the paragraph above; update `index.html`.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` all pass. Take 1280×800 screenshots of `/?time=12:00&e2e` before (from `main` HEAD in a temp worktree or the previous fallback image) and after; differences must be limited to font rendering in the card, label, buttons and loader, plus the card title's 1.375 → 1.625rem bump.
- [ ] **Step 4:** Commit `refactor: move the garden onto design tokens and journal fonts`.

---

### Task 5: Style guide, end-to-end checks, guidelines pass, decision note

**Files:**
- Create: `styleguide/index.html`, `tests/e2e/site.spec.ts`, `docs/decisions/2026-10-03-design-system.md`
- Modify: files the `web-design-guidelines` pass legitimately flags (markup/CSS only)

**Interfaces:**
- Consumes: everything above. `styleguide/index.html` links `/src/styles/site.css`, has `<main id="content" class="prose site-column">` (so the shell plugin wraps it in dev), and is **not** added to `build.rollupOptions.input`.

Style guide content: h1–h3, paragraph with a link and emphasis, ordered and unordered lists, blockquote, inline code, a code block with a 200-character line, a figure with caption, `hr`, a 6-column table, a 120-character URL; then three themed samples, each a `<section>` with inline custom properties: default; `--accent:#9a4a2a; --paper:#f6eee2; --heading-font: var(--font-text)`; `--accent:#3d5a73; --paper:#eef1f2; --heading-font: var(--font-ui)`. The two non-default accents must pass `meetsAA` on their papers — add those pairs to `tokens.test.ts`.

- [ ] **Step 1: Write e2e tests** (`site.spec.ts`, production build via the existing `playwright.config.ts`):
  - `/writing/`: `.site-bar` and `.site-footer` visible; nav link "Writing" has `aria-current="page"`; footer "← Back to the garden" navigates to `/`; `page.locator('script')` count is 0; no console errors.
  - Keyboard (Review Focus 3): first `Tab` focuses `.skip-link` and it is visible (bounding box inside the viewport); `Enter` → `document.activeElement` is `#content` or inside it. (If focus doesn't move because `main` isn't focusable, give `#content` `tabindex="-1"` in the pages — note it in the report.)
  - Fonts: on `/writing/`, after `document.fonts.ready`, `document.fonts.check('1.25rem "EB Garamond"')` and `document.fonts.check('600 2rem "Cormorant Garamond"')` are true; sum of `response.body().length` for `.woff2` responses ≤ 150 000 bytes. On `/` (`?time=12:00`, after `.is-ready`): font bytes ≤ 90 000 and no requested URL contains `eb-garamond-latin-400-italic` or `eb-garamond-latin-600`.
  - Phone overflow (Review Focus 4): in dev-only style guide it's unavailable in the prod build, so test it on `/writing/` with injected long content: at 390×844, `page.evaluate` appends a `<pre>` with a 300-char line, a 150-char URL link and a wide table into `#content`, then asserts `document.documentElement.scrollWidth <= 390`.
  - `/styleguide/` → response status 404.
- [ ] **Step 2:** Run → new tests FAIL only where behaviour is missing (e.g. 404 should already pass; that's fine — note which were RED).
- [ ] **Step 3:** Create the style guide and fix whatever the e2e tests reveal.
- [ ] **Step 4:** Run the `web-design-guidelines` skill on `src/site/shell.html`, `src/styles/*.css`, `writing/index.html`, `styleguide/index.html`; fix real findings (markup/CSS/a11y only); list each finding and its resolution in the report.
- [ ] **Step 5:** Screenshots for human review (not assertions), saved under `test-results/`: `/writing/` and `/styleguide/` (dev server) at 1280×800 and 390×844.
- [ ] **Step 6:** Write `docs/decisions/2026-10-03-design-system.md` (Context / Decision / Alternatives considered / Consequences) covering: garden-journal character; Cormorant + EB Garamond + Inter and the readability rules; light only; themed variations limited to three variables; plain CSS + build-time shell over Astro or Tailwind; the preload outcome from Task 3.
- [ ] **Step 7:** `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` all green. Commit `feat: add dev style guide and design-system e2e checks` (and `docs: record the design system decisions` separately if preferred).
