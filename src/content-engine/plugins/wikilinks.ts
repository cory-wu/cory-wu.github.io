import GithubSlugger from 'github-slugger';
import type { Html, Link, PhrasingContent, Root, Text } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';
import type { Note } from '../vault.ts';
import { escapeHtml } from './escape.ts';

export interface LinkTarget {
  slug: string;
  title: string;
  draft: boolean;
}

/** Keyed by lowercased note file name (without `.md`). */
export type LinkIndex = Map<string, LinkTarget>;

export function buildLinkIndex(notes: Note[]): LinkIndex {
  return new Map(
    notes.map((n) => [
      n.name.toLowerCase(),
      { slug: n.slug, title: n.frontmatter.title, draft: n.frontmatter.draft },
    ]),
  );
}

export interface WikilinkOptions {
  links: LinkIndex;
  dev: boolean;
  warn: (msg: string) => void;
  /** Repo-relative path of the note being processed; prefixes warnings. */
  file: string;
}

/** Matches `[[…]]` and `![[…]]`; group 1 is the optional `!`, group 2 the inner text. */
export const WIKILINK_PATTERN = /(!?)\[\[([^\][\n]+?)\]\]/g;

/** Build the node for `[[target#heading|text]]` (inner is the text between the brackets, without the `|` split). */
export function wikilinkNode(
  rawTarget: string,
  customText: string | undefined,
  opts: WikilinkOptions,
): Link | Html {
  const hash = rawTarget.indexOf('#');
  const name = (hash === -1 ? rawTarget : rawTarget.slice(0, hash)).trim();
  const heading = hash === -1 ? '' : rawTarget.slice(hash + 1).trim();
  const target = opts.links.get(name.toLowerCase());
  const fallbackText = target ? target.title + (heading ? ` › ${heading}` : '') : rawTarget.trim();
  const text = customText?.trim() || fallbackText;

  if (!target || (target.draft && !opts.dev)) {
    const reason = target ? 'is a draft' : 'was not found';
    opts.warn(`${opts.file}: wikilink target "${name}" ${reason}`);
    return { type: 'html', value: `<span class="wikilink-missing">${escapeHtml(text)}</span>` };
  }

  const anchor = heading ? `#${new GithubSlugger().slug(heading)}` : '';
  return {
    type: 'link',
    url: `/writing/${target.slug}/${anchor}`,
    children: [{ type: 'text', value: text }],
  };
}

function splitPipe(inner: string): [string, string | undefined] {
  const pipe = inner.indexOf('|');
  return pipe === -1 ? [inner, undefined] : [inner.slice(0, pipe), inner.slice(pipe + 1)];
}

export function remarkWikilinks(opts: WikilinkOptions) {
  return (tree: Root): void => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const value = node.value;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const m of value.matchAll(WIKILINK_PATTERN)) {
        if (m[1] === '!') continue; // embeds belong to remarkEmbeds
        const start = m.index;
        if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
        const [target, text] = splitPipe(m[2]);
        out.push(wikilinkNode(target, text, opts));
        last = start + m[0].length;
      }
      if (out.length === 0) return;
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}
