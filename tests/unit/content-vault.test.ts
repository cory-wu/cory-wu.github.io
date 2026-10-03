// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content-engine/errors.ts';
import { loadVault } from '../../src/content-engine/vault.ts';

const VAULT = 'tests/fixtures/vault';
const temps: string[] = [];

function tempVault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'vault-'));
  temps.push(root);
  mkdirSync(join(root, 'writing'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, 'writing', name), text);
  return root;
}

afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

describe('loadVault', () => {
  it('orders by date descending then title ascending, drafts included', () => {
    const notes = loadVault(VAULT, { includeDrafts: true });
    expect(notes.map((n) => n.slug)).toEqual(['beta-note', 'gamma', 'alpha', 'crlf']);
  });

  it('omits drafts when not included', () => {
    const notes = loadVault(VAULT, { includeDrafts: false });
    expect(notes.map((n) => n.slug)).toEqual(['gamma', 'alpha', 'crlf']);
  });

  it('never reads notes outside writing/', () => {
    const notes = loadVault(VAULT, { includeDrafts: true });
    expect(notes.some((n) => n.name === 'private' || n.file.includes('private'))).toBe(false);
  });

  it('parses a CRLF note with a BOM', () => {
    const crlf = loadVault(VAULT, { includeDrafts: true }).find((n) => n.slug === 'crlf');
    expect(crlf?.frontmatter.title).toBe('Windows Note');
    expect(crlf?.frontmatter.date).toBe('2025-12-01');
    expect(crlf?.body).not.toContain('\r');
    expect(crlf?.body).toContain('Saved with CRLF line endings and a BOM.');
  });

  it('exposes name, frontmatter and body', () => {
    const beta = loadVault(VAULT, { includeDrafts: true }).find((n) => n.slug === 'beta-note');
    expect(beta?.name).toBe('Beta Note');
    expect(beta?.frontmatter.draft).toBe(true);
    const alpha = loadVault(VAULT, { includeDrafts: true }).find((n) => n.slug === 'alpha');
    expect(alpha?.body).toContain('[[Beta Note]]');
    expect(alpha?.frontmatter.tags).toEqual(['garden', 'notes']);
  });

  it('reports repo-relative forward-slash file paths', () => {
    const notes = loadVault(VAULT, { includeDrafts: true });
    expect(notes.map((n) => n.file).sort()).toEqual([
      'tests/fixtures/vault/writing/Beta Note.md',
      'tests/fixtures/vault/writing/alpha.md',
      'tests/fixtures/vault/writing/crlf.md',
      'tests/fixtures/vault/writing/gamma.md',
    ]);
  });

  it('accepts an absolute root', () => {
    const notes = loadVault(resolve(process.cwd(), VAULT), { includeDrafts: false });
    expect(notes[0]?.file).toMatch(/^tests\/fixtures\/vault\/writing\//);
  });

  it('throws naming both files when two names share a slug', () => {
    let error: unknown;
    try {
      loadVault('tests/fixtures/vault-collision', { includeDrafts: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ContentError);
    const message = (error as ContentError).message;
    expect(message).toContain('Same Name.md');
    expect(message).toContain('same-name.md');
  });

  it('throws when a file name slugifies to nothing', () => {
    const root = tempVault({ '!!!.md': '---\ntitle: X\ndate: 2026-01-01\n---\n' });
    expect(() => loadVault(root, { includeDrafts: true })).toThrow(ContentError);
    expect(() => loadVault(root, { includeDrafts: true })).toThrow(/slug/);
  });

  it('treats empty (null) properties as absent', () => {
    const root = tempVault({
      'empty.md': '---\ntitle: Empty Props\ndate: 2026-01-01\ntags:\ndescription:\n---\n\nBody\n',
    });
    const [note] = loadVault(root, { includeDrafts: true });
    expect(note?.frontmatter.tags).toEqual([]);
    expect(note?.frontmatter.description).toBeUndefined();
  });

  it('reports invalid frontmatter against the repo-relative file', () => {
    const root = tempVault({ 'bad.md': '---\ndate: 2026-01-01\n---\n' });
    expect(() => loadVault(root, { includeDrafts: true })).toThrow(/bad\.md: title/);
  });

  it('ignores non-markdown files and subfolders in writing/', () => {
    const root = tempVault({ 'a.md': '---\ntitle: A\ndate: 2026-01-01\n---\n', 'x.txt': 'nope' });
    mkdirSync(join(root, 'writing', 'sub'));
    writeFileSync(join(root, 'writing', 'sub', 'deep.md'), '---\ntitle: D\ndate: 2026-01-01\n---\n');
    expect(loadVault(root, { includeDrafts: true }).map((n) => n.slug)).toEqual(['a']);
  });
});
