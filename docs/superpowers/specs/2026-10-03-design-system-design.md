# Site Design System — Design

Date: 2026-10-03
Status: Draft for review
Sub-project 1 of 3 (design system → content pipeline → page templates)

## Intent

The garden homepage is done; the rest of the site (writing, projects) has
only a placeholder `/writing/` page. Before building the content pipeline
and page templates, bake in one design system that every non-garden page
shares: fonts, colours, a type scale, spacing, a page shell (top bar,
footer), and styles for long-form prose. Individual pages can then take
on their own look through a small, controlled set of theme variables.

### Character

**Garden journal**: warm and literary, like a well-made notebook. Classic
book serifs, a cream-paper background, the garden's earthy palette (moss
green, terracotta), generous margins. Light only — no dark mode.

### Success criteria

- Every non-garden page gets the same shell and typography by linking one
  stylesheet and providing only its `<main>`.
- A page can change its accent colour, paper tint and heading font without
  writing CSS, and can never break readability (contrast rules) or pull in
  extra fonts.
- Text pages ship no JavaScript; fonts on a text page stay within budget.
- The garden adopts the tokens and fonts with no other visual change.

## Decisions (summary)

| Topic | Decision |
|---|---|
| Character | Garden journal (A) |
| Fonts | Cormorant Garamond (headings), EB Garamond (body), Inter (UI labels) |
| Per-page design | Themed variations: accent, paper tint, heading font only |
| Page structure | Centered single reading column, slim top bar, quiet footer |
| Colour modes | Light only |
| Implementation | Plain CSS custom properties + build-time shell injection (Vite plugin); no new framework |
| Font hosting | Self-hosted via npm `@fontsource/*` packages, Latin subset, only used weights |

## Scope

In scope:
- `src/styles/` token, base, prose, shell and font stylesheets.
- The page shell (top bar, skip link, footer) and the Vite plugin that
  injects it.
- Migrating the garden's `src/style.css` onto the tokens and fonts.
- `/writing/` placeholder wrapped in the shell.
- A dev-only `/styleguide/` page.
- A contrast helper and the tests below; a decision note.

Out of scope (later sub-projects):
- Markdown content pipeline and frontmatter parsing (sub-project 2).
- Writing index, article and project templates; a `/projects/` section
  (sub-project 3).
- Dark mode; per-page header illustrations; per-page custom stylesheets.

## Tokens (`src/styles/tokens.css`)

### Colour

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f4f1e8` | page background (themeable) |
| `--paper-raised` | `#fbf8f0` | cards, code blocks |
| `--ink` | `#1f2a1f` | body text |
| `--ink-soft` | `#4a564a` | dek (standfirst), captions |
| `--ink-muted` | `#6b746b` | dates, meta |
| `--rule` | `rgba(31, 42, 31, 0.14)` | hairlines, borders |
| `--accent` | `#2f6b3a` | links, focus rings, small details (themeable) |
| `--accent-2` | `#c8683f` | blockquote bars, highlights |

### Type

| Token | Value |
|---|---|
| `--font-display` | `'Cormorant Garamond', 'EB Garamond', Georgia, serif` |
| `--font-text` | `'EB Garamond', Georgia, serif` |
| `--font-ui` | `Inter, system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| `--heading-font` | `var(--font-display)` (themeable) |
| `--text-body` | `1.25rem` (20px), line-height 1.6 |
| `--text-h1` | `clamp(2.4rem, 5vw, 3.2rem)`, line-height 1.1 |
| `--text-h2` | `2rem`, line-height 1.15 |
| `--text-h3` | `1.5rem`, line-height 1.2 |
| `--text-ui` | `0.875rem` |
| `--text-label` | `0.8125rem`, uppercase, `letter-spacing: 0.08em` |
| `--measure` | `34em` (~68 characters at body size) |

Weights loaded: Cormorant Garamond 500 and 600; EB Garamond 400, 400
italic, 600; Inter 500.

### Readability rules (binding)

- Cormorant Garamond is used only at ≥ 1.5rem (h3 and up, site title).
- Nothing below 0.875rem is set in a serif; small text uses `--font-ui`.
- Every text colour must meet WCAG AA (4.5:1) against `--paper` and
  `--paper-raised`; `--accent` must meet AA as link text on `--paper`.

### Spacing

`--space-1` … `--space-8` = `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4` rem.

### Per-page theme contract

A page may override exactly three things, set as custom properties on its
`<body>` (by hand now, by the pipeline from frontmatter in sub-project 2):

| Override | Allowed values |
|---|---|
| `--accent` | any colour meeting AA as link text on the page's `--paper` |
| `--paper` | a light tint meeting AA with `--ink`, `--ink-soft`, `--ink-muted` |
| `--heading-font` | one of `var(--font-display)`, `var(--font-text)`, `var(--font-ui)` (frontmatter keys `display`, `text`, `ui`) |

Only already-loaded fonts are allowed, so a theme can never trigger an
extra font download. Enforcement of the contrast rules for themed pages is
sub-project 2's job, using the contrast helper defined here.

## Stylesheets (`src/styles/`)

| File | Responsibility |
|---|---|
| `fonts.css` | `@fontsource` imports for exactly the weights above, Latin subset, `font-display: swap` |
| `tokens.css` | all custom properties above, on `:root` |
| `base.css` | element defaults: `body` (paper, ink, `--font-text`, body size), links (accent, underline offset), `:focus-visible` ring in accent, `[hidden]{display:none !important}`, selection colour |
| `prose.css` | long-form styles scoped to `.prose`: headings (`--heading-font`, sizes above), paragraphs, lists, blockquote (left bar in `--accent-2`, italic), inline code and code blocks (`--font-mono`, `--paper-raised`, horizontal scroll), figures and captions (`--ink-soft`, `--font-ui` at `--text-ui`), `hr` (short centred rule), simple tables (rules only), images (max-width 100%) |
| `shell.css` | top bar, skip link, reading column (`max-width: var(--measure)`, centred, side gutter ≥ 16px), footer; phone layout |
| `site.css` | entry for text pages: imports fonts, tokens, base, prose, shell in that order |
| `garden.css` | today's `src/style.css`, moved and switched to tokens (see Garden) |

`src/style.css` is removed; `index.html` links `/src/styles/garden.css`
and text pages link `/src/styles/site.css`, both from the HTML `<head>`
(so styles apply before any JS, as fixed in commit 3e6b5c7).

## Page shell

Source: `src/site/shell.html`, containing a header block and a footer
block. Every non-garden page provides only `<main id="content" class="prose">…</main>`
inside `<body>`.

- **Skip link**: first focusable element, "Skip to content" → `#content`,
  visually hidden until focused.
- **Top bar** (`<header class="site-bar">`):
  - Left: "Cory Wu" in `--font-display` 600 at ≥ 1.5rem, linking to `/`.
  - Right: `<nav aria-label="Site">` with **Garden** (`/`) and
    **Writing** (`/writing/`) in `--font-ui`. The current section gets
    `aria-current="page"` and an accent underline. **Projects** is added
    by sub-project 3 when `/projects/` exists.
  - Hairline `--rule` below. On narrow screens the nav wraps under the
    title; no hamburger menu.
- **Footer** (`<footer class="site-footer">`): "← Back to the garden"
  (`/`) on the left; "© <year>" and a GitHub link
  (`https://github.com/cory-wu`) on the right, in `--font-ui`
  `--text-ui`, `--ink-muted`. The year is filled at build time.

### Injection (`vite-plugin-site-shell`, in `vite.config.ts` or `src/site/shell-plugin.ts`)

- `transformIndexHtml` (runs in dev and build) for every HTML entry
  except the root `index.html` (the garden).
- Inserts the header block immediately after `<body>` (skip link first)
  and the footer block immediately before `</body>`.
- Marks the current section from the page's path: `/writing/…` →
  Writing. Unknown sections get no current marker.
- Idempotent: if the page already contains `.site-bar`, it does nothing.
- Fails the build with a clear message if a page has no
  `<main id="content">`.

## Garden adoption

- `garden.css` replaces hard-coded colours with tokens (`--paper`,
  `--ink`, `--accent`, `--rule`, …) and imports `fonts.css` and
  `tokens.css`.
- Name card: heading in `--font-display` 600, description in
  `--font-text`; nav links, Reset View button, hover label and loader text
  in `--font-ui`.
- The garden loads only Cormorant 600, EB Garamond 400 and Inter 500.
- No other visual change; existing garden tests must still pass.

## `/writing/` placeholder

Keeps its "Writing is coming soon." content and back link, now inside the
shell: `<main id="content" class="prose">` with an h1 "Writing" and the
paragraph. Links `/src/styles/site.css` and preloads the EB Garamond 400
woff2.

## Style guide (dev only)

`styleguide/index.html`, served by `npm run dev` and excluded from the
production build (not in `build.rollupOptions.input`). It shows the shell
plus every prose element (h1–h3, paragraph with link, emphasis, lists,
blockquote, inline code, code block, figure with caption, hr, table) and
three themed samples side by side: default, a terracotta accent on a
warmer paper with `--heading-font: var(--font-text)`, and a blue-grey
accent with `--heading-font: var(--font-ui)`.

## Contrast helper

`src/site/contrast.ts` exports:
- `relativeLuminance(hex: string): number`
- `contrastRatio(a: string, b: string): number` (WCAG 2.x)
- `meetsAA(fg: string, bg: string): boolean` (≥ 4.5)

Accepts `#rgb` and `#rrggbb`; throws on anything else. Reused by
sub-project 2 to validate per-page themes.

## Budgets

- Fonts requested by a text page: ≤ 150 KB total (woff2, Latin).
- Fonts requested by the garden: ≤ 90 KB.
- Text pages ship no JavaScript.

## Testing

Unit (Vitest):
- `contrastRatio` against known pairs (black/white = 21; equal colours =
  1); `meetsAA` on every token text colour vs `--paper` and
  `--paper-raised`, and `--accent` vs `--paper`; invalid input throws.
- Shell plugin: injects skip link, top bar and footer exactly once; leaves
  the root `index.html` untouched; marks Writing current for
  `writing/index.html`; idempotent on re-run; throws without
  `<main id="content">`; fills the current year.
- Tokens: every `var(--…)` used in `base.css`, `prose.css`, `shell.css`
  and `garden.css` is defined in `tokens.css`; the three themeable
  variables have the defaults above. Vitest returns CSS `?raw` imports as
  empty strings, so these tests read the stylesheets with `node:fs`; add
  `@types/node` as a dev dependency for that.

E2E (Playwright, production build):
- `/writing/`: shell present; "Writing" has `aria-current="page"`; the
  skip link is the first tab stop and moves focus to `#content`; the
  footer link goes to `/`; no console errors; no `<script>` on the page.
- Fonts: on `/writing/`, `document.fonts.check` passes for
  `1.25rem "EB Garamond"` and `600 2rem "Cormorant Garamond"`; total font
  bytes requested ≤ 150 KB; on `/`, ≤ 90 KB and no EB Garamond italic or
  600 request.
- `/styleguide/` returns 404 in the production build.
- Existing garden suites (garden, landmark, modes, no-js, no-webgl) pass.

Before done: run `web-design-guidelines` on the shell and prose; take
desktop and phone screenshots of `/writing/` and `/styleguide/` (dev) for
review.

## Decision note

`docs/decisions/2026-10-03-design-system.md`: garden-journal character;
font choice (Cormorant/EB Garamond/Inter) and the readability rules that
offset Garamond's thin strokes; light only; themed variations limited to
three variables; plain CSS + build-time shell over a framework or
utility CSS.
