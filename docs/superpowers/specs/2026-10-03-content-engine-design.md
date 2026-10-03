# Markdown Content Engine — Design

Date: 2026-10-03
Status: Draft for review
Sub-project 2 of 3 (design system → **content engine** → page templates)

## Intent

Generate the site's writing pages from markdown, Quartz-style, so writing a
post means adding a note to an Obsidian vault instead of hand-authoring
HTML. Pages come out in the existing journal design system and shell, with
LaTeX, highlighted code and Obsidian syntax rendered at build time. Text
pages stay JavaScript-free.

### Success criteria

- Adding `src/content/writing/<name>.md` with valid frontmatter publishes
  `/writing/<slug>/` and lists it on `/writing/`, with no config edits.
- What renders in Obsidian (wikilinks, image embeds, callouts, math)
  renders on the site.
- Authoring mistakes fail loudly with the file and reason (build) or the
  Vite error overlay (dev); soft issues warn.
- `/writing/memorylessness/` keeps its URL and title, now from markdown.
- No JavaScript on generated pages; KaTeX CSS/fonts only on pages with math.

## Decisions (summary)

| Topic | Decision |
|---|---|
| Feature set | Quartz "core writing" only (option A) |
| Authoring | Obsidian: `src/content/` is a vault; `[[wikilinks]]`, `![[embeds]]`, `attachments/` |
| Engine | Vite plugin on unified/remark/rehype; virtual HTML entries in build, middleware in dev |
| Math | `remark-math` + `rehype-katex`, HTML + MathML, invalid LaTeX fails the build |
| Code | Shiki at build time, light theme, no runtime JS |
| Frontmatter | gray-matter + Zod schema; per-page themes validated with `meetsAA` |

## Scope

In scope: the engine (`src/content-engine/`), `content.css`, migration of
the memorylessness page, the generated `/writing/` index, a sample
`markdown-field-guide.md` note, tests, a decision note.

Out of scope: backlinks, tag pages, hover previews, graph view, search,
folder explorer, RSS, `projects/` (sub-project 3), embedding notes inside
notes.

## Content model

### Vault layout

```
src/content/
  writing/        each .md → /writing/<slug>/
  attachments/    images referenced with ![[...]]
  (anything else) ignored (private notes, templates, .obsidian/)
```

Only `writing/` (non-recursive) publishes. `.obsidian/` and other folders
are never read.

### Slugs

`slugify(fileNameWithoutExt)`: lowercase; whitespace runs → `-`; characters
other than `a–z`, `0–9`, `-` removed; repeated `-` collapsed; leading and
trailing `-` trimmed. `What Makes Memorylessness.md` →
`what-makes-memorylessness`. Two notes with the same slug fail the build,
naming both files. An empty slug fails the build.

### Frontmatter schema (Zod)

| Field | Type | Required | Effect |
|---|---|---|---|
| `title` | non-empty string | yes | `<h1>`, `<title>` (`<title> — Cory Wu`), index entry |
| `date` | `YYYY-MM-DD` (valid calendar date; YAML dates accepted and normalised) | yes | shown under the title as e.g. "3 October 2026" (`Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' })`); sorts the index |
| `description` | string | no | `<meta name="description">`, index blurb |
| `tags` | string[] | no | labels under the title; no tag pages |
| `draft` | boolean | no (false) | excluded from production build and index; in dev rendered with a "Draft" badge and listed on the index with the badge |
| `toc` | boolean | no | forces the TOC on/off; default on when the page has ≥ 3 h2/h3 headings |
| `theme.accent` | `#rgb`/`#rrggbb` | no | `--accent`; must pass `meetsAA(accent, paper)` |
| `theme.paper` | `#rgb`/`#rrggbb` | no | `--paper`; `--ink`, `--ink-soft`, `--ink-muted` must each pass `meetsAA` on it |
| `theme.headingFont` | `display` \| `text` \| `ui` | no | `--heading-font: var(--font-<value>)` |

Unknown top-level keys are allowed and ignored (Obsidian adds its own).
When only `theme.accent` is set, it is checked against the default paper
`#f4f1e8`.

Error format (one line per problem):
`src/content/writing/<file>.md: <field>: <problem>` — e.g.
`…/memorylessness.md: theme.accent: #b0c4b1 is 1.8:1 on #f4f1e8, needs 4.5:1`.

### Migration

`writing/memorylessness/index.html` → `src/content/writing/memorylessness.md`
(title "What makes memorylessness?", today's date, the placeholder body).
`writing/index.html` and `writing/memorylessness/index.html` are deleted,
and their entries removed from `build.rollupOptions.input`.

## Markdown features

- **GFM**: tables, strikethrough, task lists, autolinks, footnotes.
  Footnotes render as a `<section class="footnotes">` headed "Notes" with
  back-references.
- **Math**: `$…$` inline, `$$…$$` display, via `remark-math` +
  `rehype-katex` with `output: 'htmlAndMathml'`, `throwOnError: true`. A
  KaTeX error fails the build with the file and the offending expression.
  A page containing math gets
  `<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css">`
  in `<head>`; Vite bundles it and its fonts.
- **Code**: fenced blocks highlighted by Shiki (`@shikijs/rehype`) at build
  time with the bundled `github-light` theme; `content.css` sets the block
  background to `--paper-raised`. A language Shiki doesn't know renders as
  plain text and warns.
- **Wikilinks** (`plugins/wikilinks.ts`): `[[Name]]`, `[[Name|Text]]`,
  `[[Name#Heading]]`, `[[Name#Heading|Text]]`. `Name` resolves
  case-insensitively against published note file names (without `.md`);
  `#Heading` maps to the target heading's id (same slugger as headings).
  Link text defaults to the target's frontmatter `title` (plus
  ` › Heading` when a heading is given). Unresolved or draft targets (in
  production) render as `<span class="wikilink-missing">Text</span>` and
  warn; in dev `.wikilink-missing` has a dashed underline, in production
  it is plain text.
- **Embeds** (`plugins/embeds.ts`): `![[file.png]]`, `![[file.png|Alt]]`,
  `![[file.png|400]]`, `![[file.png|Alt|400]]` for
  `png, jpg, jpeg, gif, webp, svg, avif` in `src/content/attachments/`
  → `<img src="/src/content/attachments/<file>" alt="…" width height loading="lazy" decoding="async">`
  with intrinsic `width`/`height` from `image-size` (scaled when a width is
  given). Missing file fails the build. Alt defaults to `""`. `![[Note]]`
  (non-image) renders as a wikilink and warns. Standard markdown images
  `![alt](/src/content/attachments/file.png)` (absolute path) also work
  (Vite rewrites them); a relative path is left as written and warns.
- **Callouts** (`plugins/callouts.ts`): a blockquote whose first line is
  `[!type]`, `[!type]-` or `[!type]+` with an optional title. Types: `note`,
  `tip`, `warning`, `danger`, `quote`, `example`; unknown types render as
  `note` and warn. Output: `<aside class="callout callout-<type>">` with a
  `<p class="callout-title">` (title or the capitalised type); foldable
  forms render as `<details class="callout callout-<type>">` with
  `<summary class="callout-title">`, `open` for `+`.
- **Headings**: `rehype-slug` ids (github-slugger); each h2–h4 gets an
  appended `<a class="heading-anchor" href="#id" aria-label="Link to this section">#</a>`.
- **TOC** (`toc.ts`): `<nav class="toc" aria-label="Contents"><ol>` of h2
  with nested h3, inserted after the article header; shown per the `toc`
  rule above.

## Architecture (`src/content-engine/`)

All modules run in Node inside Vite (config, dev server, build), never in
the browser.

| Module | Responsibility | Interface (summary) |
|---|---|---|
| `slug.ts` | slug rule | `slugify(name: string): string` |
| `schema.ts` | frontmatter schema + theme contrast | `parseFrontmatter(data: unknown, file: string): Frontmatter` (throws `ContentError` listing all problems) |
| `vault.ts` | scan + read notes | `loadVault(root: string, opts: { includeDrafts: boolean }): Note[]` (sorted by date desc, then title) |
| `markdown.ts` | unified pipeline | `renderNote(note: Note, ctx: RenderContext): Rendered` where `Rendered = { html, headings, hasMath, warnings }` |
| `plugins/wikilinks.ts` | `[[…]]` | remark plugin taking a `LinkIndex` |
| `plugins/embeds.ts` | `![[…]]` | remark plugin taking the attachments dir |
| `plugins/callouts.ts` | `> [!type]` | remark plugin |
| `toc.ts` | TOC markup | `tocHtml(headings: Heading[]): string` |
| `templates.ts` | full pages | `articlePage(note, rendered, opts): string`, `writingIndex(notes, opts): string` |
| `errors.ts` | error type | `class ContentError extends Error` (file + list of problems) |
| `plugin.ts` | Vite integration | `contentEngine(opts?: { contentDir?: string }): Plugin` |

### Vite integration (`plugin.ts`)

- **Build** (`config` hook, `command === 'build'`): load the vault without
  drafts; for each note add input `writing/<slug>/index.html`, plus
  `writing/index.html`. `resolveId` claims those ids; `load` returns the
  rendered page HTML. Vite's HTML pipeline then applies the shell plugin and
  rewrites asset URLs (attachments, KaTeX CSS) to hashed files, emitting
  `dist/writing/<slug>/index.html`.
- **Dev** (`configureServer`): middleware for `/writing/` and
  `/writing/<slug>/` (with or without trailing slash) renders the page with
  drafts included, passes it through `server.transformIndexHtml`, and
  responds. Unknown slugs fall through (404). A `ContentError` is sent to
  the client error overlay (`server.ws.send({ type: 'error', … })`) and
  answered with a plain 500 page showing the message. Changes under
  `src/content/` trigger `server.ws.send({ type: 'full-reload' })`.
- Warnings go to the Vite logger (`logger.warn`), prefixed with the file.

### Generated page markup

Article (`articlePage`):
- `<head>`: charset, viewport (`viewport-fit=cover`), favicon,
  `<title>{title} — Cory Wu</title>`, description meta when set,
  `theme-color` = page paper, `site.css` link, KaTeX link when `hasMath`.
- `<body>` with `style="--accent:…;--paper:…;--heading-font:var(--font-…)"`
  only for set theme fields.
- `<main id="content" class="prose site-column" tabindex="-1">` →
  `<header class="article-header"><h1>…</h1><p class="article-meta"><time datetime="YYYY-MM-DD">…</time>` + tags `<span class="tag">` + dev-only `<span class="draft-badge">Draft</span>`, then TOC, then body, then footnotes.
- All frontmatter strings are HTML-escaped.

Index (`writingIndex`): `<h1>Writing</h1>` and an
`<ol class="post-list">` of `<li><a href="/writing/<slug>/">title</a><time>…</time><p>description</p></li>`
newest first; an empty vault renders "Nothing published yet."

## Styling (`src/styles/content.css`, imported by `site.css` after `prose.css`)

Article header and meta (Inter labels), tags, draft badge (`--accent-2`),
TOC (bordered, h3 indented), callouts (left rule + faint tint per type,
title in Inter; tint and text colours must pass `meetsAA` — asserted in
`tokens.test.ts`), heading anchors (hidden until heading hover/focus-within,
accent colour), footnotes (smaller, after a rule), `.katex-display`
(`overflow-x: auto`), Shiki `pre` (`background: var(--paper-raised)`
overriding Shiki's inline background), `.wikilink-missing` (dev dashed
underline via a `data-dev` attribute on `<body>` set only in dev), post
list.

## Errors and warnings

| Condition | Severity |
|---|---|
| Invalid/missing frontmatter field, theme contrast failure | error |
| Invalid LaTeX | error |
| Missing embedded image | error |
| Slug collision or empty slug | error |
| Unresolved/draft wikilink target | warning |
| Unknown code language, unknown callout type, note embed, relative markdown image | warning |

## Testing

Unit (Vitest, fixture vault `tests/fixtures/vault/`):
- `slugify` cases; collisions and empty slug fail with both file names.
- Schema: each field, YAML date normalisation, unknown keys ignored, theme
  contrast failure message exact.
- `loadVault`: drafts kept/dropped, non-`writing/` files ignored, sort order.
- Wikilinks: all four forms, case-insensitivity, default text from title,
  missing/draft target → span + warning.
- Embeds: alt, width, alt+width, intrinsic size, missing file throws, note
  embed warns.
- Callouts: every type, unknown type, `-`/`+` folding, custom title.
- Pipeline: TOC threshold and `toc` override, math → `.katex` + `<math>`,
  invalid LaTeX throws with the expression, Shiki highlights `ts`,
  unknown language warns, footnotes section, heading anchors.
- Templates: escaping, theme variables on `<body>`, KaTeX link iff
  `hasMath`, draft badge only when `opts.dev`.
- Plugin: build inputs list equals published notes + index.

E2E (Playwright, production build):
- `/writing/memorylessness/` from markdown: title, shell, Writing current,
  no `<script>`.
- `/writing/markdown-field-guide/`: `.katex` and `math` present; Shiki
  token spans in a code block; a wikilink resolving to
  `/writing/memorylessness/`; a callout and a foldable `<details>`;
  `.footnotes`; `.toc`; no console errors.
- `/writing/`: lists exactly the published notes, newest first (draft
  exclusion itself is covered by the unit tests, since the real vault has
  no drafts).
- KaTeX stylesheet requested on the field guide, not on memorylessness.
- 390px: field guide `scrollWidth ≤ 390`.
- Existing suites pass.

## Decision note

`docs/decisions/2026-10-03-content-engine.md`: Quartz core subset only;
Obsidian vault authoring; unified pipeline in a Vite plugin with virtual
HTML entries over a prebuild script or Quartz itself; KaTeX at build time
with failing builds on bad LaTeX; Shiki at build time; warnings vs errors
policy.
