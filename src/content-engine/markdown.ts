import type { Element, ElementContent, Root as HastRoot } from 'hast';
import type { Root as MdastRoot } from 'mdast';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { bundledLanguages, bundledLanguagesAlias } from 'shiki';
import rehypeShiki from '@shikijs/rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { ContentError } from './errors.ts';
import { remarkCallouts } from './plugins/callouts.ts';
import { remarkEmbeds } from './plugins/embeds.ts';
import { remarkWikilinks, type LinkIndex } from './plugins/wikilinks.ts';
import type { Heading } from './toc.ts';
import type { Note } from './vault.ts';

export type { Heading } from './toc.ts';

export interface RenderContext {
  links: LinkIndex;
  attachmentsDir: string;
  dev: boolean;
  warn: (msg: string) => void;
}

export interface Rendered {
  html: string;
  headings: Heading[];
  hasMath: boolean;
  warnings: string[];
}

const SPECIAL_LANGS = new Set(['text', 'plaintext', 'txt', 'plain', 'ansi']);
const FOOTNOTE_LABEL_ID = 'footnote-label';
const FALLBACK_LANG = 'text';
const LANG_CLASS = 'language-';

function textOf(node: { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? [])
    .map((c) => textOf(c as { type: string; value?: string; children?: unknown[] }))
    .join('');
}

function isKnownLang(lang: string): boolean {
  return SPECIAL_LANGS.has(lang) || lang in bundledLanguages || lang in bundledLanguagesAlias;
}

/**
 * Obsidian/Pandoc inline-math rules for single-`$` spans: the opening `$` must be followed by a
 * non-space, the closing `$` preceded by a non-space and not followed by a digit. Spans that fail
 * become literal text. Sets `flag.value` when real math remains.
 */
function remarkMathRules(source: string, flag: { value: boolean }) {
  const isSpace = (c: string | undefined): boolean => c === undefined || /\s/.test(c);
  return (tree: MdastRoot): void => {
    visit(tree, (node, index, parent) => {
      if (node.type === 'math') {
        flag.value = true;
        return;
      }
      if (node.type !== 'inlineMath') return;
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined || !parent || index === undefined) {
        flag.value = true;
        return;
      }
      const raw = source.slice(start, end);
      const single = raw.startsWith('$') && !raw.startsWith('$$');
      const valid =
        !single ||
        (!isSpace(raw[1]) && !isSpace(raw[raw.length - 2]) && !/\d/.test(source[end] ?? ''));
      if (valid) {
        flag.value = true;
        return;
      }
      parent.children.splice(index, 1, { type: 'text', value: raw });
    });
  };
}

/** Rewrites unknown fenced-code languages to plain text and warns. */
function rehypeLanguageFallback(warn: (msg: string) => void) {
  return (tree: HastRoot): void => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (node.tagName !== 'code' || (parent as Element | undefined)?.tagName !== 'pre') return;
      const classes = Array.isArray(node.properties.className) ? node.properties.className : [];
      const cls = classes.find((c) => String(c).startsWith(LANG_CLASS));
      if (cls === undefined) return;
      const lang = String(cls).slice(LANG_CLASS.length);
      if (isKnownLang(lang)) return;
      warn(`unknown code language "${lang}"; rendered as plain text`);
      node.properties.className = classes.map((c) => (c === cls ? `${LANG_CLASS}${FALLBACK_LANG}` : c));
    });
  };
}

/** Turns KaTeX failures (reported as vfile messages) into a ContentError. */
function failOnKatexErrors(file: string, vfile: VFile): void {
  const failure = vfile.messages.find((m) => m.source === 'rehype-katex');
  if (!failure) return;
  const ancestors = (failure as unknown as { ancestors?: ElementContent[] }).ancestors;
  const expression = ancestors?.length ? textOf(ancestors[ancestors.length - 1]) : '';
  const detail = failure.cause instanceof Error ? failure.cause.message : failure.reason;
  throw new ContentError(file, [`invalid LaTeX: ${expression}: ${detail}`]);
}

/** Collects h2–h4 and appends the anchor link to each. */
function rehypeHeadings(into: Heading[]) {
  return (tree: HastRoot): void => {
    visit(tree, 'element', (node: Element) => {
      const match = /^h([234])$/.exec(node.tagName);
      const id = node.properties.id;
      if (!match || typeof id !== 'string') return;
      if (id === FOOTNOTE_LABEL_ID) return; // the "Notes" label stays out of the TOC and gets no anchor
      into.push({ depth: Number(match[1]) as Heading['depth'], id, text: textOf(node) });
      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: { className: ['heading-anchor'], href: `#${id}`, ariaLabel: 'Link to this section' },
        children: [{ type: 'text', value: '#' }],
      });
    });
  };
}

export async function renderNote(note: Note, ctx: RenderContext): Promise<Rendered> {
  const warnings: string[] = [];
  const warn = (msg: string): void => {
    const full = msg.startsWith(`${note.file}: `) ? msg : `${note.file}: ${msg}`;
    warnings.push(full);
    ctx.warn(full);
  };
  const math = { value: false };
  const headings: Heading[] = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkMathRules, note.body, math)
    .use(remarkWikilinks, { links: ctx.links, dev: ctx.dev, warn, file: note.file })
    .use(remarkEmbeds, {
      attachmentsDir: ctx.attachmentsDir,
      links: ctx.links,
      dev: ctx.dev,
      warn,
      file: note.file,
    })
    .use(remarkCallouts, { warn, file: note.file })
    .use(remarkRehype, { allowDangerousHtml: true, footnoteLabel: 'Notes', footnoteLabelTagName: 'h2', footnoteLabelProperties: {} })
    // rehype-katex always renders with throwOnError: true and reports failures as vfile
    // messages (handled in failOnKatexErrors); its Options type omits the key.
    .use(rehypeKatex, {
      output: 'htmlAndMathml',
      // KaTeX would console.warn strict-mode findings without the note; route them through warn.
      strict: (code: string, msg: string) => {
        warn(`KaTeX: ${msg} [${code}]`);
        return 'ignore';
      },
    })
    .use(rehypeLanguageFallback, (msg: string) => warn(msg))
    // Singleton highlighter inside shiki; grammars load lazily so plain notes pay nothing.
    .use(rehypeShiki, { theme: 'github-light', fallbackLanguage: FALLBACK_LANG, lazy: true, langs: [] })
    .use(rehypeSlug)
    .use(rehypeHeadings, headings)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const file = await processor.process(note.body);
  failOnKatexErrors(note.file, file);
  return { html: String(file), headings, hasMath: math.value, warnings };
}
