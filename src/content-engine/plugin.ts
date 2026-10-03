import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { ContentError } from './errors.ts';
import { renderNote } from './markdown.ts';
import { escapeHtml } from './plugins/escape.ts';
import { buildLinkIndex, type LinkIndex } from './plugins/wikilinks.ts';
import { articlePage, writingIndex } from './templates.ts';
import { loadVault, type Note } from './vault.ts';

const DEFAULT_CONTENT_DIR = 'src/content';
const INDEX_ID = 'writing/index.html';

type Warn = (msg: string) => void;

export interface Content {
  notes: Note[];
  links: LinkIndex;
}

export interface PageContext extends Content {
  contentDir: string;
  dev: boolean;
  warn: Warn;
}

/** Loads the vault and its link index; a vault without a `writing/` folder is empty (with a warning). */
export function loadContent(contentDir: string, opts: { includeDrafts: boolean; warn: Warn }): Content {
  if (!existsSync(resolve(process.cwd(), contentDir, 'writing'))) {
    opts.warn(`${contentDir}/writing not found; no writing pages will be generated`);
    return { notes: [], links: new Map() };
  }
  const notes = loadVault(contentDir, { includeDrafts: opts.includeDrafts });
  return { notes, links: buildLinkIndex(notes) };
}

const isPublished = (n: Note): boolean => !n.frontmatter.draft;

/** Root-relative HTML ids for the index and every published note, as build inputs. */
export function pageIdsFor(notes: Note[]): string[] {
  return [INDEX_ID, ...notes.filter(isPublished).map((n) => `writing/${n.slug}/index.html`)];
}

/** `/writing/x/index.html?q#h` -> `/writing/x`. */
function normalisePath(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  return path.replace(/\/index\.html$/, '').replace(/\/+$/, '');
}

/** Renders the page for a URL, or null when the URL is not a (visible) writing page. */
export async function renderPage(url: string, ctx: PageContext): Promise<string | null> {
  const path = normalisePath(url);
  const visible = ctx.dev ? ctx.notes : ctx.notes.filter(isPublished);
  if (path === '/writing') return writingIndex(visible, { dev: ctx.dev });

  const match = /^\/writing\/([^/]+)$/.exec(path);
  const note = match ? visible.find((n) => n.slug === match[1]) : undefined;
  if (!note) return null;

  const rendered = await renderNote(note, {
    links: ctx.links,
    attachmentsDir: resolve(process.cwd(), ctx.contentDir, 'attachments'),
    dev: ctx.dev,
    warn: ctx.warn,
  });
  return articlePage(note, rendered, { dev: ctx.dev });
}

function errorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Content error</title></head>
  <body><main id="content"><h1>Content error</h1><pre>${escapeHtml(message)}</pre></main></body>
</html>
`;
}

/** Dev: render writing pages per request (drafts included), live-reloading on vault edits. */
function serveContent(server: ViteDevServer, contentDir: string): void {
  const warn: Warn = (msg) => server.config.logger.warn(msg);
  // The page that hit the error reloads and reconnects after the broadcast below, so a client
  // that connects while the error stands is sent it again to show the overlay.
  let lastError: string | null = null;
  server.ws.on('vite:client:connect', (_data, client) => {
    if (lastError !== null) client.send({ type: 'error', err: { message: lastError, stack: '' } });
  });

  server.middlewares.use(async (req, res, next) => {
    const url = req.url ?? '';
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !/^\/writing(?:[/?#]|$)/.test(url)) return next();
    try {
      const content = loadContent(contentDir, { includeDrafts: true, warn });
      const html = await renderPage(url, { ...content, contentDir, dev: true, warn });
      lastError = null;
      if (html === null) return next();
      const page = `${normalisePath(url)}/index.html`;
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml(page, html, req.originalUrl));
    } catch (err) {
      if (!(err instanceof ContentError)) return next(err);
      lastError = err.message;
      server.config.logger.error(err.message);
      server.ws.send({ type: 'error', err: { message: err.message, stack: '' } });
      const body = errorPage(err.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/writing/error.html', body).catch(() => body));
    }
  });

  server.watcher.add(contentDir);
  server.watcher.on('all', (_event, file) => {
    if (shouldReload(file, contentDir)) server.ws.send({ type: 'full-reload' });
  });
}

/** Whether a changed path should reload the dev page: notes in writing/, files in attachments/, no dot-segments. */
export function shouldReload(file: string, contentDir: string): boolean {
  const rel = toPosix(relative(contentDir, file));
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return false;
  const parts = rel.split('/');
  if (parts.some((part) => part.startsWith('.'))) return false;
  if (parts.length === 2 && parts[0] === 'writing') return parts[1].endsWith('.md');
  return parts.length >= 2 && parts[0] === 'attachments';
}

type Input = string | string[] | Record<string, string> | undefined;
type InlineLimit = number | ((file: string, content: Buffer) => boolean | undefined) | undefined;

const toPosix = (path: string): string => path.split(sep).join('/');

/** Attachments always ship as hashed files (cacheable across pages); other assets keep the user's rule. */
function keepAttachmentsAsFiles(attachmentsDir: string, user: InlineLimit) {
  const prefix = `${toPosix(attachmentsDir)}/`;
  return (file: string, content: Buffer): boolean | undefined => {
    if (toPosix(file).startsWith(prefix)) return false;
    if (typeof user === 'function') return user(file, content);
    return user === undefined ? undefined : content.length < user;
  };
}

function mergeInputs(existing: Input, ids: string[]): Record<string, string> {
  let base: Record<string, string> = {};
  if (typeof existing === 'string') base = { main: existing };
  else if (Array.isArray(existing)) base = Object.fromEntries(existing.map((p, i) => [`input${i}`, p]));
  else if (existing) base = { ...existing };
  return { ...base, ...Object.fromEntries(ids.map((id) => [id.replace(/\/index\.html$/, ''), id])) };
}

/** Generates /writing/ and /writing/<slug>/ from the markdown vault (see the content engine spec). */
export function contentEngine(opts: { contentDir?: string } = {}): Plugin {
  let root = process.cwd();
  let contentDir = resolve(root, opts.contentDir ?? DEFAULT_CONTENT_DIR);
  let built: Content | null = null;
  let pageIds = new Set<string>();
  let logWarn: Warn | null = null;
  const pending: string[] = [];
  const seen = new Set<string>();
  const warn: Warn = (msg) => {
    if (seen.has(msg)) return;
    seen.add(msg);
    if (logWarn) logWarn(msg);
    else pending.push(msg);
  };

  const toPageId = (id: string): string | null => {
    const rel = toPosix(isAbsolute(id) ? relative(root, id) : id.replace(/^\.?\//, ''));
    return pageIds.has(rel) ? rel : null;
  };

  return {
    name: 'content-engine',
    config(config, env) {
      root = resolve(config.root ?? process.cwd());
      contentDir = resolve(root, opts.contentDir ?? DEFAULT_CONTENT_DIR);
      if (env.command !== 'build') return;
      // Load drafts too so wikilinks to them get the precise "is a draft" warning; they are
      // never published (pageIdsFor, the index and renderPage all filter them out).
      built = loadContent(contentDir, { includeDrafts: true, warn });
      const ids = pageIdsFor(built.notes);
      pageIds = new Set(ids);
      const key = config.build?.rolldownOptions ? 'rolldownOptions' : 'rollupOptions';
      return {
        build: {
          [key]: { input: mergeInputs(config.build?.[key]?.input as Input, ids) },
          assetsInlineLimit: keepAttachmentsAsFiles(resolve(contentDir, 'attachments'), config.build?.assetsInlineLimit),
        },
      };
    },
    configResolved(config) {
      logWarn = (msg) => config.logger.warn(msg);
      for (const msg of pending.splice(0)) logWarn(msg);
    },
    resolveId(id) {
      const page = built ? toPageId(id) : null;
      return page ? resolve(root, page) : null;
    },
    async load(id) {
      const page = built ? toPageId(id) : null;
      if (!built || !page) return null;
      return renderPage(`/${page}`, { ...built, contentDir, dev: false, warn });
    },
    configureServer(server) {
      serveContent(server, contentDir);
    },
  };
}
