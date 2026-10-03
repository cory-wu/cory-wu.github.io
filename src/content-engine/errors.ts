/** A content authoring problem; `message` has one `<file>: <problem>` line per problem. */
export class ContentError extends Error {
  readonly file: string;
  readonly problems: string[];

  constructor(file: string, problems: string[]) {
    super(problems.map((p) => `${file}: ${p}`).join('\n'));
    this.name = 'ContentError';
    this.file = file;
    this.problems = [...problems];
  }
}
