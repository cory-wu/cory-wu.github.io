import { readdirSync, readFileSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';
import { ContentError } from './errors.ts';
import { parseFrontmatter, type Frontmatter } from './schema.ts';
import { slugify } from './slug.ts';

export interface Note {
  /** Repository-relative path with forward slashes, e.g. src/content/writing/alpha.md */
  file: string;
  /** File name without `.md` */
  name: string;
  slug: string;
  frontmatter: Frontmatter;
  body: string;
}

/** Obsidian writes empty properties as YAML null; treat them as absent. */
function withoutNulls(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
}

function readNote(absolute: string): Note {
  const file = relative(process.cwd(), absolute).split(sep).join('/');
  const name = basename(absolute, '.md');
  const slug = slugify(name);
  if (!slug) throw new ContentError(file, [`file name "${name}" has an empty slug`]);

  const text = readFileSync(absolute, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const parsed = matter(text);
  const frontmatter = parseFrontmatter(withoutNulls(parsed.data), file);
  return { file, name, slug, frontmatter, body: parsed.content };
}

function compareNotes(a: Note, b: Note): number {
  if (a.frontmatter.date !== b.frontmatter.date) return a.frontmatter.date < b.frontmatter.date ? 1 : -1;
  return a.frontmatter.title.localeCompare(b.frontmatter.title);
}

function assertUniqueSlugs(notes: readonly Note[]): void {
  const seen = new Map<string, Note>();
  for (const note of notes) {
    const other = seen.get(note.slug);
    if (other) {
      throw new ContentError(note.file, [
        `slug "${note.slug}" collides with ${other.file}; rename one of ${other.name}.md and ${note.name}.md`,
      ]);
    }
    seen.set(note.slug, note);
  }
}

/** Load `<root>/writing/*.md` (non-recursive). Throws ContentError on invalid notes or slug collisions. */
export function loadVault(root: string, opts: { includeDrafts: boolean }): Note[] {
  const dir = resolve(process.cwd(), root, 'writing');
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();
  const notes = files.map((f) => readNote(resolve(dir, f)));
  assertUniqueSlugs(notes);
  return notes.filter((n) => opts.includeDrafts || !n.frontmatter.draft).sort(compareNotes);
}
