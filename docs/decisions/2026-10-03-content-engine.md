# Content engine: Obsidian vault to static pages

Date: 2026-10-03
Status: accepted

## Context

The site needs essays and notes. The author writes in Obsidian, so wikilinks,
embeds, callouts, footnotes and `$…$` math must work as authored. The site is
static (Vite + TypeScript, GitHub Pages) with no backend and, on generated
pages, no client JavaScript.

## Decision

- Support the Quartz core subset only (wikilinks, embeds, callouts, footnotes,
  math, highlighted code, tables, task lists), not the whole of Quartz.
- Author in an Obsidian vault at `src/content/writing/`. Only `*.md` files
  directly in that folder publish; `.obsidian/` and other folders are never
  read. Images live in `src/content/attachments/`.
- A unified (remark/rehype) pipeline runs inside a Vite plugin that emits
  virtual HTML entries, so pages go through Vite's normal HTML, CSS and asset
  handling and the shell plugin wraps them.
- KaTeX renders at build time. Invalid LaTeX fails the build.
- Shiki highlights at build time, with grammars loaded lazily.
- Errors throw `ContentError` and fail the build (the dev server shows the
  overlay). Warnings go through the Vite logger, each prefixed with
  `src/content/writing/<file>.md:`.

## Alternatives considered

- A prebuild script writing HTML files: loses dev-server integration and
  hashing of CSS and assets, and needs a second watcher.
- Quartz itself: brings its own site shell, client scripts and build, which
  conflicts with the existing Vite site and the no-script constraint.
- Client-side rendering of markdown, KaTeX or Shiki: ships JavaScript and
  flashes unrendered content; build-time output is static and fast.

## Consequences

- Rulings made while building:
  - R1: Obsidian writes empty properties (`tags:`) as YAML null. These keys are
    dropped before validation and count as absent. A deliberately null required
    field reports "missing" rather than "null".
  - R2: a missing vault folder is an empty vault ("Nothing published yet.")
    with a logger warning, not a crash. A mistyped content dir publishes
    nothing, but the warning says so.
  - R3: the footnotes heading "Notes" is a visible h2 but is excluded from the
    TOC and from its heading count; it is document furniture, not a section.
  - R4: Shiki grammars load lazily and the highlighter is warmed once in tests,
    so the suite does not time out on a cold load.
  - R5: inline `$…$` follows Obsidian/Pandoc rules: the opening `$` is followed
    by a non-space, the closing `$` is preceded by a non-space and not followed
    by a digit. Otherwise the text stays literal ("$5 and $10" is prose). A
    rare `$ x $` with inner spaces renders literally.
- Virtual HTML entries worked in Vite 8 with no fallback needed.
- Attachments are kept as hashed files (not inlined) in builds.
- Generated pages carry no script. The KaTeX stylesheet links only on pages
  with math. KaTeX fonts add weight to those pages.
- Callouts render as `div role="note"` (not `aside`) so they do not become
  page landmarks; foldable ones are `details`.
- Raw HTML in notes is passed through by design: the vault has a single
  author, and an inline `<script>` there would break the no-JS rule, so it is
  the author's responsibility not to write one.
- Known open items (deferred, minor):
  - wikilinks containing inline markdown (for example `[[*note*]]`) fail
    silently;
  - `#` or `?` in attachment file names break the generated image URL;
  - the dev error state is cleared by 404s and broadcast to all open tabs;
  - the R2 warning shows an absolute path;
  - heading anchors are invisible on touch devices (they appear on hover).
