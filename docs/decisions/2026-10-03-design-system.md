# Site design system: garden journal

Date: 2026-10-03
Status: Accepted

## Context

The garden homepage was finished, but every other page (starting with
`/writing/`) had no design beyond a system font and a cream background.
Before building the content pipeline and page templates, the site needed
one shared look that pages can vary without each one re-inventing type,
colour and layout.

## Decision

- **Character: garden journal.** Warm and literary, like a well-made
  notebook: book serifs, cream paper, moss-green links, terracotta details.
  Light only.
- **Fonts: Cormorant Garamond (headings), EB Garamond (body), Inter (UI
  labels)**, self-hosted from `@fontsource`, Latin subset, only the weights
  used (about 145 KB for all six files; a text page loads ~70–100 KB, the
  garden ~71 KB).
- **Readability rules that offset Garamond's thin strokes:** body text at
  1.25rem; Cormorant only at 1.5rem and up; nothing below 0.875rem in a
  serif; every text colour at WCAG AA on the papers. The spec's
  `--ink-muted` (`#6b746b`) failed AA at 4.29:1, so it became `#677067`.
- **Per-page design = themed variations**, limited to three variables a
  page may override: `--accent`, `--paper` and `--heading-font` (only
  fonts already loaded). Themes must keep AA contrast; `src/site/contrast.ts`
  is the shared check.
- **Plain CSS custom properties plus a build-time shell.** Tokens, base,
  prose and shell stylesheets live in `src/styles/`; the top bar, skip
  link and footer live in `src/site/shell.html` and a Vite
  `transformIndexHtml` plugin inserts them into every page except the
  garden. Text pages ship no JavaScript.
- **Vite runs as a multi-page app (`appType: 'mpa'`)** so unknown paths
  404 in dev and preview, as they do on GitHub Pages.
- **The garden adopts the tokens and fonts lightly**: Cormorant for the
  card title (raised from 1.375rem to 1.625rem to respect the 1.5rem
  floor), EB Garamond for its description, Inter 500 for labels and the
  button.

## Alternatives considered

- **Quiet modern sans or a technical notebook look** — cleaner or more
  engineering-forward, but less of the garden's handmade warmth.
- **Fraunces + Source Serif 4, or Newsreader** — sturdier on screens; the
  Garamond pair was chosen for character, with the rules above to protect
  readability.
- **Dark mode** (system or garden-clock driven) — doubles the work for
  every per-page theme; deferred.
- **Art-directed pages with their own stylesheets** — more freedom, more
  maintenance; per-page variety is capped at three variables for now.
- **Astro, or Tailwind** — Astro would replace the Vite + TypeScript stack
  the garden is built on; Tailwind would spread the design across class
  lists instead of one set of stylesheets.

## Consequences

- New text pages link `/src/styles/site.css` and provide only
  `<main id="content" class="prose site-column" tabindex="-1">`.
- The content pipeline must validate per-page themes with `meetsAA` and
  map `headingFont: display | text | ui` to the three font variables.
- Every page (garden included) preloads the three fonts it paints first —
  EB Garamond 400, Cormorant Garamond 600, Inter 500 (~71 KB) — so they are
  requested with the HTML instead of after the CSS parses. The preloads work
  because Vite rewrites the `node_modules` hrefs to the same hashed files the
  CSS references; text pages get them from the shell's head block.
- Each web font has a size-matched local fallback (`size-adjust` on Georgia
  or Arial: EB Garamond 86.3%, Cormorant 88.7%, Inter 107.5%, measured from
  rendered text widths), so if a font still arrives after first paint the
  swap barely reflows text (within ~2% instead of ~18–30%).
- A dev-only style guide at `/styleguide/` shows every element and the
  theme samples; it is not part of the production build.
