import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { imageSize } from 'image-size';
import type { Html, PhrasingContent, Root, Text } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';
import { ContentError } from '../errors.ts';
import { escapeHtml } from './escape.ts';
import { WIKILINK_PATTERN, wikilinkNode, type LinkIndex } from './wikilinks.ts';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
const SRC_PREFIX = '/src/content/attachments/';

export interface EmbedOptions {
  attachmentsDir: string;
  links: LinkIndex;
  dev: boolean;
  warn: (msg: string) => void;
  /** Repo-relative path of the note being processed; used in errors and warnings. */
  file: string;
}

function isImageName(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot !== -1 && IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/** `file|Alt|400` -> parts; a trailing all-digit part is the width. */
function parseEmbed(inner: string): { target: string; alt: string; width?: number } {
  const parts = inner.split('|');
  const target = parts[0].trim();
  let width: number | undefined;
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1].trim())) {
    width = Number(parts.pop()!.trim());
  }
  return { target, alt: parts.slice(1).join('|').trim(), width };
}

function imageNode(inner: string, opts: EmbedOptions): Html {
  const { target, alt, width } = parseEmbed(inner);
  const path = resolve(opts.attachmentsDir, target);
  const insideDir = !/[\\/]/.test(target) && path.startsWith(resolve(opts.attachmentsDir));
  if (!insideDir || !existsSync(path)) {
    throw new ContentError(opts.file, [
      `embedded image "${target}" not found in ${opts.attachmentsDir}`,
    ]);
  }

  let size: ReturnType<typeof imageSize>;
  try {
    size = imageSize(readFileSync(path));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ContentError(opts.file, [`embedded image "${target}": ${message}`]);
  }
  const w = size.width;
  const h = size.height;
  let attrs = '';
  if (w > 0 && h > 0) {
    const outW = width ?? w;
    const outH = width === undefined ? h : Math.max(1, Math.round((h * width) / w));
    attrs = ` width="${outW}" height="${outH}"`;
  } else if (width !== undefined) {
    attrs = ` width="${width}"`;
  }
  const src = escapeHtml(SRC_PREFIX + encodeURI(target));
  return {
    type: 'html',
    value: `<img src="${src}" alt="${escapeHtml(alt)}"${attrs} loading="lazy" decoding="async">`,
  };
}

function embedNode(inner: string, opts: EmbedOptions): PhrasingContent {
  const { target, alt } = parseEmbed(inner);
  if (isImageName(target)) return imageNode(inner, opts);
  opts.warn(`${opts.file}: embed target "${target}" is not an image; rendered as a link`);
  return wikilinkNode(target, alt || undefined, opts);
}

export function remarkEmbeds(opts: EmbedOptions) {
  return (tree: Root): void => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const value = node.value;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const m of value.matchAll(WIKILINK_PATTERN)) {
        if (m[1] !== '!') continue;
        if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
        out.push(embedNode(m[2], opts));
        last = m.index + m[0].length;
      }
      if (out.length === 0) return;
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}
