import type { Blockquote, Paragraph, PhrasingContent, Root } from 'mdast';
import { visit } from 'unist-util-visit';

const TYPES = new Set(['note', 'tip', 'warning', 'danger', 'quote', 'example']);
const MARKER = /^\[!([A-Za-z][\w-]*)\]([+-])?[ \t]*/;

export interface CalloutOptions {
  warn: (msg: string) => void;
  /** Repo-relative path of the note being processed; prefixes warnings. */
  file: string;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Split the paragraph's inline children into the title line and the remaining body. */
function splitTitle(rest: PhrasingContent[]): { title: PhrasingContent[]; body: PhrasingContent[] } {
  const title: PhrasingContent[] = [];
  for (let i = 0; i < rest.length; i++) {
    const child = rest[i];
    if (child.type === 'text') {
      const nl = child.value.indexOf('\n');
      if (nl !== -1) {
        const head = child.value.slice(0, nl);
        if (head) title.push({ type: 'text', value: head });
        const tail = child.value.slice(nl + 1);
        const body = tail ? [{ type: 'text', value: tail } as PhrasingContent] : [];
        return { title, body: [...body, ...rest.slice(i + 1)] };
      }
    } else if (child.type === 'break') {
      return { title, body: rest.slice(i + 1) };
    }
    title.push(child);
  }
  return { title, body: [] };
}

export function remarkCallouts(opts: CalloutOptions) {
  return (tree: Root): void => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0];
      if (first?.type !== 'paragraph') return;
      const lead = first.children[0];
      if (lead?.type !== 'text') return;
      const match = MARKER.exec(lead.value);
      if (!match) return;

      const declared = match[1].toLowerCase();
      const type = TYPES.has(declared) ? declared : 'note';
      if (type !== declared) {
        opts.warn(`${opts.file}: unknown callout type "${declared}"; rendered as note`);
      }
      const fold = match[2];

      const afterMarker = lead.value.slice(match[0].length);
      const rest: PhrasingContent[] = [
        ...(afterMarker ? [{ type: 'text', value: afterMarker } as PhrasingContent] : []),
        ...first.children.slice(1),
      ];
      const { title, body } = splitTitle(rest);

      const titleNode: Paragraph = {
        type: 'paragraph',
        children: title.length > 0 ? title : [{ type: 'text', value: capitalise(type) }],
        data: {
          hName: fold ? 'summary' : 'p',
          hProperties: { className: ['callout-title'] },
        },
      };
      const remaining = body.length > 0 ? [{ type: 'paragraph', children: body } as Paragraph] : [];
      node.children = [titleNode, ...remaining, ...node.children.slice(1)];
      node.data = {
        hName: fold ? 'details' : 'aside',
        hProperties: {
          className: ['callout', `callout-${type}`],
          ...(fold === '+' ? { open: true } : {}),
        },
      };
    });
  };
}
