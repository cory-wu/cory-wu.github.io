import { z } from 'zod';
import { contrastRatio } from '../site/contrast.ts';
import { ContentError } from './errors.ts';

export type HeadingFont = 'display' | 'text' | 'ui';

export interface Frontmatter {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  description?: string;
  tags: string[];
  draft: boolean;
  toc?: boolean;
  theme?: { accent?: string; paper?: string; headingFont?: HeadingFont };
}

export const DEFAULT_PAPER = '#f4f1e8';
export const INK_COLOURS = [
  ['--ink', '#1f2a1f'],
  ['--ink-soft', '#4a564a'],
  ['--ink-muted', '#677067'],
] as const;
const MIN_CONTRAST = 4.5;

const isCalendarDate = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
};

const toIsoDay = (v: unknown): unknown =>
  v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : v;

const colour = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be #rgb or #rrggbb');

const schema = z.object({
  title: z.string('must be a string').trim().min(1, 'must not be empty'),
  date: z.preprocess(
    toIsoDay,
    z
      .string('must be a YYYY-MM-DD date')
      .refine(isCalendarDate, 'must be a valid YYYY-MM-DD calendar date'),
  ),
  description: z.string('must be a string').optional(),
  tags: z.array(z.string('must be a string'), 'must be a list of strings').default([]),
  draft: z.boolean('must be true or false').default(false),
  toc: z.boolean('must be true or false').optional(),
  theme: z
    .object({
      accent: colour.optional(),
      paper: colour.optional(),
      headingFont: z.enum(['display', 'text', 'ui'], 'must be display, text or ui').optional(),
    })
    .optional(),
});

const formatPath = (path: ReadonlyArray<PropertyKey>): string => path.map(String).join('.');

function ratio(fg: string, bg: string): string {
  return `${contrastRatio(fg, bg).toFixed(1)}:1`;
}

function contrastProblems(theme: Frontmatter['theme']): string[] {
  if (!theme) return [];
  const paper = theme.paper ?? DEFAULT_PAPER;
  const problems: string[] = [];
  if (theme.accent && contrastRatio(theme.accent, paper) < MIN_CONTRAST) {
    problems.push(`theme.accent: ${theme.accent} is ${ratio(theme.accent, paper)} on ${paper}, needs 4.5:1`);
  }
  if (theme.paper) {
    for (const [token, value] of INK_COLOURS) {
      if (contrastRatio(value, paper) < MIN_CONTRAST) {
        problems.push(`theme.paper: ${token} ${value} is ${ratio(value, paper)} on ${paper}, needs 4.5:1`);
      }
    }
  }
  return problems;
}

/** Validate raw frontmatter; throws one ContentError listing every problem. */
export function parseFrontmatter(data: unknown, file: string): Frontmatter {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContentError(
      file,
      result.error.issues.map((i) => (i.path.length ? `${formatPath(i.path)}: ${i.message}` : i.message)),
    );
  }
  const problems = contrastProblems(result.data.theme);
  if (problems.length) throw new ContentError(file, problems);
  return result.data as Frontmatter;
}
