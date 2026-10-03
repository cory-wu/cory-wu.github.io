# Markdown Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `/writing/` and `/writing/<slug>/` from an Obsidian vault in `src/content/`, with KaTeX, Shiki, wikilinks, image embeds, callouts, footnotes and a table of contents, rendered at build time into the existing journal shell.

**Architecture:** Node-side modules in `src/content-engine/` (slug → schema → vault → unified pipeline with three remark plugins → templates) feed a Vite plugin that serves generated pages as virtual HTML build inputs and through a dev middleware; Vite's HTML pipeline then applies the existing shell plugin and asset rewriting.

**Tech Stack:** Vite 8, TypeScript 6, unified 11 (`remark-parse`, `remark-gfm`, `remark-math`, `remark-rehype`, `rehype-katex` + `katex`, `rehype-slug`, `rehype-stringify`), `@shikijs/rehype` + `shiki` 4, `gray-matter`, `zod` 4, `image-size` 2, `github-slugger` 2, `unist-util-visit` 5, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-content-engine-design.md`

## Global Constraints

- Only `src/content/writing/*.md` (non-recursive) publishes; `.obsidian/` and other folders are never read. Images live in `src/content/attachments/`.
- Slug rule, frontmatter fields, error message format, wikilink/embed/callout syntaxes, TOC rule and error-vs-warning table exactly as the spec.
- Errors throw `ContentError` (build fails; dev shows the Vite overlay). Warnings go through a `warn(message)` callback (Vite logger in the plugin), each prefixed `src/content/writing/<file>.md:`.
- Generated pages ship no `<script>`; KaTeX CSS link only when the page has math; all frontmatter text HTML-escaped.
- Generated pages are full HTML documents with `<main id="content" class="prose site-column" tabindex="-1">` so the existing shell plugin wraps them.
- Modules imported (directly or transitively) by `vite.config.ts` import each other with explicit `.ts` extensions (existing config-loader convention in `vite.config.ts`).
- Stylesheets linked from HTML `<head>`, never imported from JS. Light only. New colours must pass `meetsAA` (`src/site/contrast.ts`).
- Commits: conventional, staged by explicit path (never `git add -A`; untracked `.claude/`, `.agents/`, `CLAUDE.md`, `skills-lock.json`, `inspiration/` are the user's), ending with the authoring model's `Co-Authored-By` trailer.

## Review Focus

1. **A note title or description containing `<`, `&`, quotes or `</title>`** — must render as text everywhere it appears (`<title>`, `<h1>`, meta, index, wikilink text). (Test in Task 5.)
2. **Editing a note while `npm run dev` is running, including introducing and then fixing an error** — the page reloads, the overlay shows the error, and fixing it recovers without a restart. (Test in Task 6, e2e against a dev server is not required; unit-test the middleware's error path and the watcher's reload message.)
3. **A note file name with spaces, capitals or punctuation (`What's New? (2026).md`)** — slug is valid and wikilinks by the original name still resolve. (Test in Tasks 1 and 3.)
4. **Windows-style line endings or a BOM at the top of a note** — frontmatter still parses. (Test in Task 2.)
5. **A wide display equation or long code line on a 390px phone** — no horizontal page scroll. (Test in Task 6.)

---

## File Structure

```
src/content-engine/errors.ts        ContentError (Task 1)
src/content-engine/slug.ts          slugify (Task 1)
src/content-engine/schema.ts        Frontmatter type + parseFrontmatter (Task 1)
src/content-engine/vault.ts         Note type + loadVault (Task 2)
src/content-engine/plugins/wikilinks.ts  (Task 3)
src/content-engine/plugins/embeds.ts     (Task 3)
src/content-engine/plugins/callouts.ts   (Task 3)
src/content-engine/markdown.ts      renderNote (Task 4)
src/content-engine/toc.ts           tocHtml (Task 4)
src/content-engine/templates.ts     articlePage, writingIndex (Task 5)
src/content-engine/plugin.ts        contentEngine Vite plugin (Task 6)
src/styles/content.css              (Task 5)
src/content/writing/memorylessness.md      (Task 6, migrated)
src/content/writing/markdown-field-guide.md (Task 6)
src/content/attachments/garden-tile.svg     (Task 6, used by the field guide)
tests/fixtures/vault/…              fixture vault (Tasks 2–4)
tests/unit/content-*.test.ts        (Tasks 1–6)
tests/e2e/content.spec.ts           (Task 6)
docs/decisions/2026-10-03-content-engine.md (Task 7)
```

Deleted in Task 6: `writing/index.html`, `writing/memorylessness/index.html` (and their `rollupOptions.input` entries).

---

### Task 1: Dependencies, errors, slugs, frontmatter schema

**Files:**
- Modify: `package.json` (deps listed in Tech Stack; `@types/mdast`, `@types/hast` as devDependencies)
- Create: `src/content-engine/errors.ts`, `slug.ts`, `schema.ts`; `tests/unit/content-schema.test.ts`

**Interfaces:**
- Produces: `class ContentError extends Error { constructor(file: string, problems: string[]) }` — `message` is the problems joined by `\n`, each line `${file}: ${problem}`; exposes `file` and `problems`.
- Produces: `slugify(name: string): string` per the spec's rule.
- Produces: `type HeadingFont = 'display' | 'text' | 'ui'`; `interface Frontmatter { title: string; date: string /* YYYY-MM-DD */; description?: string; tags: string[]; draft: boolean; toc?: boolean; theme?: { accent?: string; paper?: string; headingFont?: HeadingFont } }`; `parseFrontmatter(data: unknown, file: string): Frontmatter` — throws one `ContentError` listing every problem (Zod issues formatted as `<dotted.path>: <message>`, plus contrast problems). `DEFAULT_PAPER = '#f4f1e8'`, ink colours taken from the token values (`#1f2a1f`, `#4a564a`, `#677067`) as exported constants.

- [ ] **Step 1:** Install: `npm i unified remark-parse remark-gfm remark-math remark-rehype rehype-katex katex rehype-slug rehype-stringify @shikijs/rehype shiki gray-matter zod image-size github-slugger unist-util-visit && npm i -D @types/mdast @types/hast`. Expected: exit 0.
- [ ] **Step 2: Write failing tests** (`content-schema.test.ts`):
  - `slugify`: `'memorylessness'` → `'memorylessness'`; `'What Makes Memorylessness'` → `'what-makes-memorylessness'`; `"What's New? (2026)"` → `'whats-new-2026'` (Review Focus 3); `'  a  --  b  '` → `'a-b'`; `'???'` → `''`.
  - `parseFrontmatter`: minimal valid `{ title: 'T', date: '2026-10-03' }` → `{ title: 'T', date: '2026-10-03', tags: [], draft: false }`; a JS `Date` (as gray-matter yields for YAML dates) normalises to `YYYY-MM-DD` in UTC; `date: '2026-02-30'` fails; missing title and bad date reported together in one error (two lines); unknown keys (`aliases`, `cssclasses`) ignored; `theme: { accent: '#b0c4b1' }` fails with exactly `f.md: theme.accent: #b0c4b1 is 1.8:1 on #f4f1e8, needs 4.5:1` (ratio to one decimal, use `contrastRatio`); a dark `theme.paper` (`#777777`) fails naming each failing ink; `theme.headingFont: 'serif'` fails; `toc: 'yes'` fails.
- [ ] **Step 3:** `npx vitest run tests/unit/content-schema.test.ts` → FAIL (modules missing).
- [ ] **Step 4:** Implement the three modules (Zod schema with `.passthrough()` or default stripping for unknown keys; contrast checks after shape validation).
- [ ] **Step 5:** Focused test PASS; `npm test`, `npx tsc --noEmit` clean.
- [ ] **Step 6:** Commit `feat: add content errors, slugs and frontmatter schema`.

---

### Task 2: Vault loading

**Files:**
- Create: `src/content-engine/vault.ts`, `tests/unit/content-vault.test.ts`, fixture vault `tests/fixtures/vault/` with:
  - `writing/alpha.md` (date 2026-01-02, links `[[Beta Note]]`, `[[gamma]]`), `writing/Beta Note.md` (date 2026-03-04, `draft: true`), `writing/gamma.md` (date 2026-03-04, title "Gamma"), `writing/crlf.md` (date 2025-12-01, title "Windows Note", saved with CRLF line endings and a UTF-8 BOM — write it from the test setup or commit with `.gitattributes` `tests/fixtures/vault/writing/crlf.md -text`), `notes/private.md` (must be ignored), `.obsidian/app.json`, `attachments/pixel.png` (a real 3×2 PNG — generate once with a tiny node snippet in the step and commit it).
  - `tests/fixtures/vault-collision/writing/Same Name.md` and `same-name.md`.

**Interfaces:**
- Consumes: `slugify`, `parseFrontmatter`, `ContentError` (Task 1).
- Produces: `interface Note { file: string /* repo-relative, e.g. src/content/writing/alpha.md */; name: string /* file name without .md */; slug: string; frontmatter: Frontmatter; body: string }`; `loadVault(root: string, opts: { includeDrafts: boolean }): Note[]` — reads `<root>/writing/*.md` synchronously, strips a BOM, normalises CRLF to LF before gray-matter, sorts by date desc then title asc; throws `ContentError` on empty slug or collision (collision message names both files).

- [ ] **Step 1: Write failing tests:** slugs in order with drafts → `['beta-note', 'gamma', 'alpha', 'crlf']` (Beta Note and Gamma share a date, so title ascending puts "Beta Note" first); without drafts → `['gamma', 'alpha', 'crlf']`; `notes/private.md` never appears; CRLF+BOM note parses its title (Review Focus 4); collision fixture throws naming `Same Name.md` and `same-name.md`; each `Note.file` is repo-relative.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `vault.ts` and the fixtures.
- [ ] **Step 4:** PASS; full `npm test`, `tsc` clean.
- [ ] **Step 5:** Commit `feat: load notes from the content vault`.

---

### Task 3: Obsidian remark plugins

**Files:**
- Create: `src/content-engine/plugins/wikilinks.ts`, `embeds.ts`, `callouts.ts`; `tests/unit/content-plugins.test.ts`

**Interfaces:**
- Consumes: `Note` (Task 2), `slugify`.
- Produces:
  - `interface LinkTarget { slug: string; title: string; draft: boolean }`; `type LinkIndex = Map<string /* lowercased note name */, LinkTarget>`; `buildLinkIndex(notes: Note[]): LinkIndex`.
  - `remarkWikilinks(opts: { links: LinkIndex; dev: boolean; warn: (msg: string) => void })` — replaces `[[…]]` in text nodes (not inside code) with `link` nodes to `/writing/<slug>/` (+ `#<github-slugger id>` for `#Heading`), default text = target title (+ ` › Heading`); missing or (when `!dev`) draft targets → `html` node `<span class="wikilink-missing">Text</span>` + `warn`.
  - `remarkEmbeds(opts: { attachmentsDir: string; links: LinkIndex; dev: boolean; warn })` — parses `![[file.ext|Alt|400]]` forms per the spec into `html` nodes `<img src="/src/content/attachments/<file>" alt="…" width="…" height="…" loading="lazy" decoding="async">` (size from `image-size`, scaled proportionally when a width is given; svg uses its viewBox/width attributes via image-size); missing image → throw `ContentError`; non-image target → treated as a wikilink + `warn`. Escape `alt` and `src`.
  - `remarkCallouts(opts: { warn })` — transforms blockquotes starting `[!type]`, `[!type]-`, `[!type]+` (+ optional title) into `html`-wrapped containers: `<aside class="callout callout-<type>">` with `<p class="callout-title">`; folding → `<details class="callout callout-<type>"[ open]><summary class="callout-title">`. Body children keep their markdown rendering (wrap with `html` open/close nodes around the original children, or use `data.hName`/`hProperties` — implementer's choice, the output HTML is what's tested). Unknown type → `note` + `warn`.

- [ ] **Step 1: Write failing tests** (run each plugin in a minimal `unified().use(remarkParse).use(plugin).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true })` pipeline; assert on HTML):
  - Wikilinks: `[[gamma]]` → `<a href="/writing/gamma/">Gamma</a>`; `[[GAMMA|see this]]` → text "see this"; `[[gamma#Some Heading]]` → `href="/writing/gamma/#some-heading"`, text `Gamma › Some Heading`; `[[Beta Note]]` (draft) in prod → missing span + one warning; in dev → link; `[[nope]]` → missing span + warning naming `nope`; `` `[[gamma]]` `` inside inline code untouched; a note named `What's New? (2026)` linked as `[[What's New? (2026)]]` → `/writing/whats-new-2026/` (Review Focus 3).
  - Embeds: `![[pixel.png]]` → `width="3" height="2"` and `alt=""`; `|A pixel` → alt; `|30` → `width="30" height="20"`; `|A pixel|30` both; `![[missing.png]]` throws `ContentError` mentioning `missing.png`; `![[gamma]]` → link + warning; alt with `"<>` is escaped.
  - Callouts: each of the six types gets `callout-<type>` and default title (capitalised type); `> [!tip] Custom` → title "Custom"; `> [!mystery]` → `callout-note` + warning; `-` → `<details` without `open`; `+` → `<details` with `open`; body markdown (e.g. `**bold**`) renders inside.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the three plugins (use `unist-util-visit`).
- [ ] **Step 4:** PASS; `npm test`, `tsc` clean.
- [ ] **Step 5:** Commit `feat: add wikilink, embed and callout remark plugins`.

---

### Task 4: Markdown pipeline and table of contents

**Files:**
- Create: `src/content-engine/markdown.ts`, `src/content-engine/toc.ts`; `tests/unit/content-markdown.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `interface Heading { depth: 2 | 3 | 4; id: string; text: string }`; `interface RenderContext { links: LinkIndex; attachmentsDir: string; dev: boolean; warn: (msg: string) => void }`; `interface Rendered { html: string; headings: Heading[]; hasMath: boolean; warnings: string[] }`; `renderNote(note: Note, ctx: RenderContext): Promise<Rendered>` — `warnings` collects every warning (also forwarded to `ctx.warn`), each prefixed `${note.file}: `.
- Produces: `tocHtml(headings: Heading[]): string` (h2 with nested h3; h4 excluded) and `shouldShowToc(headings: Heading[], override?: boolean): boolean` (override wins; else ≥ 3 h2/h3).

Pipeline order: `remarkParse` → `remarkGfm` → `remarkMath` → `remarkWikilinks` → `remarkEmbeds` → `remarkCallouts` → `remarkRehype({ allowDangerousHtml: true, footnoteLabel: 'Notes', footnoteLabelTagName: 'h2' })` → `rehypeKatex({ output: 'htmlAndMathml', throwOnError: true })` → `rehypeShiki({ theme: 'github-light' })` → `rehypeSlug` → a local rehype step that collects h2–h4 into `headings` and appends `<a class="heading-anchor" href="#id" aria-label="Link to this section">#</a>` → `rehypeStringify({ allowDangerousHtml: true })`. `hasMath` = the source contained math nodes. KaTeX errors are caught and rethrown as `ContentError(note.file, ['invalid LaTeX: <expression>: <katex message>'])`. Unknown Shiki languages: configure a fallback to `text` and warn `unknown code language "<lang>"`. The footnotes section must be `<section class="footnotes" …>` with an h2 "Notes".

- [ ] **Step 1: Write failing tests** (build a `Note` inline; fixture vault for links/attachments):
  - `$e^{i\pi}+1=0$` → HTML contains `class="katex"` and `<math`; `hasMath === true`; no math → `false`.
  - `$$\frac{1}{$$` (invalid) → throws `ContentError` whose message contains `invalid LaTeX` and `\frac{1}{`.
  - ` ```ts\nconst x: number = 1\n``` ` → contains `class="shiki` and a `<span style=` token; ` ```madeuplang ` → no throw, one warning containing `madeuplang`.
  - Footnote `a[^1]\n\n[^1]: note` → `class="footnotes"` and an h2 `Notes`.
  - Headings `## A`, `### B`, `## C` → `headings` ids `a`, `b`, `c`; each has `class="heading-anchor"`; `shouldShowToc` true; with two headings false; override `false` wins; `tocHtml` nests B under A.
  - A wikilink and an embed render through the full pipeline (integration with Task 3).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; `npm test`, `tsc` clean.
- [ ] **Step 5:** Commit `feat: render notes through the markdown pipeline`.

---

### Task 5: Page templates and content styles

**Files:**
- Create: `src/content-engine/templates.ts`, `src/styles/content.css`; `tests/unit/content-templates.test.ts`
- Modify: `src/styles/site.css` (import `content.css` after `prose.css`), `tests/unit/tokens.test.ts` (site.css import order; callout tint contrast; `content.css` vars resolve)

**Interfaces:**
- Consumes: `Note`, `Rendered`, `tocHtml`, `shouldShowToc`.
- Produces: `interface PageOptions { dev: boolean }`; `articlePage(note: Note, rendered: Rendered, opts: PageOptions): string`; `writingIndex(notes: Note[], opts: PageOptions): string`; `escapeHtml(s: string): string`; `formatDate(iso: string): string` (`Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' })` → "3 October 2026").

Markup exactly as the spec's "Generated page markup" (head contents, `<body>` theme style only for set fields, `data-dev` attribute on `<body>` when `opts.dev`, article header, TOC when `shouldShowToc`, body, index list, empty-state text "Nothing published yet."). Theme style string: `--accent:<hex>;--paper:<hex>;--heading-font:var(--font-<value>)` (only set fields, in that order); `theme-color` meta = theme paper or `#f4f1e8`.

`content.css` defines on `:root` the callout tints `--callout-<type>-bg` and `--callout-<type>-rule` for the six types (light tints of moss, terracotta, amber, red, ink, slate), plus styles listed in the spec's Styling section, built from tokens.

- [ ] **Step 1: Write failing tests:**
  - Review Focus 1: a note titled `A <b>&</b> "Q" </title>` with description `x < y & "z"` → the parsed document's `<title>` text is `A <b>&</b> "Q" </title> — Cory Wu`, `h1` text equals the title, no `<b>` element exists, meta description content equals the description; same title in `writingIndex` is text.
  - Theme: `{ accent: '#9a4a2a', paper: '#f8f1e6', headingFont: 'text' }` → body style `--accent:#9a4a2a;--paper:#f8f1e6;--heading-font:var(--font-text)`; no theme → no `style` attribute; theme-color matches.
  - KaTeX link present iff `rendered.hasMath`; `<main id="content" class="prose site-column" tabindex="-1">`; no `<script`.
  - `data-dev` and `.draft-badge` only with `opts.dev` and `draft: true`.
  - TOC present for 3 headings, absent for 2; date shown as `3 October 2026` inside `<time datetime="2026-10-03">`; tags render as `.tag`.
  - Index: newest first, `href="/writing/<slug>/"`, description shown; empty list → "Nothing published yet."
  - `tokens.test.ts`: site.css imports `fonts, tokens, base, prose, content, shell`; every `var(--…)` in `content.css` resolves to `tokens.css` or `content.css`; `--ink` and `--ink-soft` pass `meetsAA` on each `--callout-*-bg`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement templates and styles.
- [ ] **Step 4:** PASS; `npm test`, `tsc` clean.
- [ ] **Step 5:** Commit `feat: add article and index templates with content styles`.

---

### Task 6: Vite plugin, migration, field guide, end-to-end

**Files:**
- Create: `src/content-engine/plugin.ts`, `tests/unit/content-plugin.test.ts`, `src/content/writing/memorylessness.md`, `src/content/writing/markdown-field-guide.md`, `src/content/attachments/garden-tile.svg`, `tests/e2e/content.spec.ts`
- Modify: `vite.config.ts` (add `contentEngine()` before `siteShell()`; remove the two writing inputs), `tests/e2e/site.spec.ts` (the first-article tests now target the generated page — keep their assertions; update only if markup moved)
- Delete: `writing/index.html`, `writing/memorylessness/index.html`

**Interfaces:**
- Consumes: everything above.
- Produces: `contentEngine(opts?: { contentDir?: string }): Plugin` (default `src/content`) and, for testing, `pageIdsFor(notes: Note[]): string[]` (`['writing/index.html', 'writing/<slug>/index.html', …]`) and `renderPage(url: string, ctx: { notes: Note[]; links: LinkIndex; contentDir: string; dev: boolean; warn }): Promise<string | null>` (null for unknown URLs; handles `/writing`, `/writing/`, `/writing/<slug>`, `/writing/<slug>/`, and the `…/index.html` forms).

Plugin behaviour per the spec's "Vite integration": `config(config, env)` adds inputs when `env.command === 'build'` (merge with existing `rollupOptions.input`); `resolveId(id)` claims `<root>/writing/…/index.html` and the bare relative forms for generated pages, returning the absolute path; `load(id)` returns `renderPage` output; `configureServer(server)` registers middleware **directly** (pre-Vite HTML handling) that renders pages with drafts, runs `server.transformIndexHtml(url, html)`, and on `ContentError` sends `server.ws.send({ type: 'error', err: { message, stack: '' } })` and responds 500 with the escaped message; `server.watcher.add(contentDir)` and on change/add/unlink under it sends `{ type: 'full-reload' }`. If Vite refuses to treat a virtual id as an HTML entry, fall back to writing generated files to their real paths (`writing/…/index.html`) in `buildStart` with a gitignore entry for `writing/` and removing them in `closeBundle` — record a ruling.

Content:
- `memorylessness.md`: `title: "What makes memorylessness?"`, `date: 2026-10-03`, `description: "An essay in progress."`, body `*This essay is still being written.*`.
- `markdown-field-guide.md`: `title: "A field guide to this site's markdown"`, `date: 2026-10-02`, description, `tags: [meta]`; sections (≥ 3 h2) demonstrating: inline and display math (include one deliberately wide display equation), a TypeScript code block, a 200-char code line, a table, a task list, a footnote, `[[memorylessness]]` and `[[memorylessness|an aliased link]]`, `![[garden-tile.svg|A low-poly grass block|160]]`, one `> [!note]`, one `> [!tip]-` foldable, one `> [!warning]+`.
- `garden-tile.svg`: the loader's three-polygon grass block with explicit `width`/`height`.

- [ ] **Step 1: Write failing tests:**
  - Unit (`content-plugin.test.ts`, fixture vault): `pageIdsFor` lists index + each published slug; `renderPage` returns HTML for `/writing/`, `/writing/gamma`, `/writing/gamma/`, `/writing/gamma/index.html`, and null for `/writing/nope/` and `/elsewhere/`; with `dev: true` a draft renders, with `dev: false` it returns null; a vault whose note has bad frontmatter makes `renderPage` reject with `ContentError` (Review Focus 2's error path).
  - E2E (`content.spec.ts`, production build): memorylessness page from markdown (title, h1, `.site-nav` Writing current, no `<script>`, no KaTeX CSS request); field guide: `.katex` and `math` present, a `.shiki` block with token spans, `a[href="/writing/memorylessness/"]` with text "What makes memorylessness?" and one with "an aliased link", `aside.callout-note`, `details.callout-tip:not([open])`, `details.callout-warning[open]`, `.footnotes`, `nav.toc`, the embedded image has `width="160"`, the KaTeX stylesheet was requested, no console errors; at 390px `scrollWidth ≤ 390` (Review Focus 5); `/writing/` lists exactly the memorylessness page and the field guide, newest first.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the plugin, migrate content, delete the hand-written pages, update `vite.config.ts`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run build` (inspect `dist/writing/markdown-field-guide/index.html`: shell present once, hashed KaTeX CSS and SVG URLs), `npm run test:e2e` — all green. Start `npm run dev`, load `/writing/markdown-field-guide/`, break its frontmatter (e.g. remove `title`), confirm the overlay, restore it, confirm recovery (Review Focus 2, manual); note the result in the report.
- [ ] **Step 5:** Commit `feat: generate writing pages from the markdown vault`.

---

### Task 7: Guidelines pass, screenshots, decision note

**Files:**
- Create: `docs/decisions/2026-10-03-content-engine.md`
- Modify: files flagged by the guidelines pass (markup/CSS only)

- [ ] **Step 1:** Run the `web-design-guidelines` skill on `src/content-engine/templates.ts` output (review a built field-guide page) and `src/styles/content.css`; fix real findings; list each and its resolution in the report.
- [ ] **Step 2:** Screenshots for human review (not assertions) of the field guide and `/writing/` at 1280×800 and 390×844 under `test-results/content-engine/`.
- [ ] **Step 3:** Write the decision note (Context / Decision / Alternatives considered / Consequences) per the spec's Decision note section, including any rulings from Task 6.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` green. Commit `docs: record the content engine decisions` (plus `fix:` commits for guideline findings).
