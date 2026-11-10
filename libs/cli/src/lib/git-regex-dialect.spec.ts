import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const SRC = join(__dirname, '..');
const GNU_ONLY_ESCAPE = /(?<!\\)(?:\\\\)*\\[sSbBdDwW]/;
const REGEX_FLAGS = new Set(['-G', '-E', '-P', '--grep', '--extended-regexp', '--perl-regexp', '--basic-regexp', '-e']);
const GIT_SUBCOMMANDS = new Set([
  'log',
  'grep',
  'show',
  'diff',
  'rev-list',
  'blame',
  'whatchanged',
  'shortlog',
  'ls-files',
]);
const FIXED_FLAGS = new Set(['-F', '--fixed-strings']);
const JOINED_FLAG = /^(--grep=|-G|-E|-P|-e)([\s\S]+)$/;

const WHY =
  'Apple Git (macOS) compiles POSIX regexes without \\s \\S \\b \\d \\w, Linux git has them, so a pattern that works in CI silently matches nothing on a Mac. ' +
  'Use POSIX classes: [[:space:]], [^[:space:]], [[:digit:]], [[:alnum:]_], and a word boundary as (^|[^[:alnum:]_]) or ([^[:alnum:]_]|$).';

const sourceFilesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFilesOf(path);
    return /\.ts$/.test(entry.name) && !/\.(spec|stories)\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [path]
      : [];
  });

const textOf = (node: ts.Node, constants: Map<string, string>): string | null => {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node))
    return node.head.text + node.templateSpans.map((s) => '\0' + s.literal.text).join('');
  if (ts.isIdentifier(node)) return constants.get(node.text) ?? null;
  return null;
};

const gitRegexViolationsOf = (fileName: string, source: string): string[] => {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const constants = new Map<string, string>();
  const violations: string[] = [];

  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const text = textOf(node.initializer, new Map());
      if (text !== null) constants.set(node.name.text, text);
    }
    ts.forEachChild(node, collect);
  };
  collect(file);

  const where = (node: ts.Node) => `${fileName}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const check = (node: ts.Node, pattern: string) => {
    if (GNU_ONLY_ESCAPE.test(pattern))
      violations.push(`${where(node)} passes ${JSON.stringify(pattern)} to git. ${WHY}`);
  };

  const checkArray = (array: ts.ArrayLiteralExpression) => {
    const elements = array.elements;
    const literals = elements.map((element) => textOf(element, constants));
    if (!literals.includes('git') && !GIT_SUBCOMMANDS.has(literals[0] ?? '')) return;

    const grepAt = literals.indexOf('grep');
    const gitGrep =
      grepAt !== -1 && (grepAt === 0 || literals[grepAt - 1] === 'git' || literals[grepAt - 1] === '--no-pager');
    const fixed = literals.some((text) => text !== null && FIXED_FLAGS.has(text));

    elements.forEach((element, index) => {
      const text = literals[index];

      if (text !== null && REGEX_FLAGS.has(text) && !(gitGrep && fixed)) {
        const next = elements[index + 1];
        if (!next || ts.isSpreadElement(next)) return;
        const pattern = literals[index + 1];
        if (pattern === null) {
          violations.push(
            `${where(next)} builds a git regex argument from an expression the check cannot follow; pass a literal or a const string.`,
          );
        } else check(next, pattern);
        return;
      }

      const joined = text === null ? null : JOINED_FLAG.exec(text);
      if (joined && !(gitGrep && fixed)) check(element, joined[2]!);
    });

    if (gitGrep && !fixed) {
      const afterGrep = elements.slice(grepAt + 1);
      const dashDash = literals.indexOf('--', grepAt + 1);
      const patterns = afterGrep.slice(0, dashDash === -1 ? undefined : dashDash - grepAt - 1);
      const positional = patterns.find((element, i) => {
        const text = literals[grepAt + 1 + i];
        return text === null || !text.startsWith('-');
      });
      if (positional && !ts.isSpreadElement(positional)) {
        const text = textOf(positional, constants);
        if (text === null)
          violations.push(
            `${where(positional)} builds a git grep pattern from an expression the check cannot follow; pass a literal or a const string.`,
          );
        else check(positional, text);
      }
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isArrayLiteralExpression(node)) checkArray(node);
    ts.forEachChild(node, visit);
  };
  visit(file);

  return violations;
};

describe('git regex dialect', () => {
  it('passes no GNU-only regex escape to git in the cli source', () => {
    const violations = sourceFilesOf(SRC).flatMap((path) =>
      gitRegexViolationsOf(relative(SRC, path), readFileSync(path, 'utf8')),
    );

    expect(violations).toEqual([]);
  });

  it('flags the GNU-only escapes in every way an argument reaches git', () => {
    const flagged = (code: string) => gitRegexViolationsOf('probe.ts', code).length;

    expect(flagged(`x(['git', 'log', '-G', '^\\\\s*Impl\\\\b'])`)).toBe(1);
    expect(flagged(`x(['git', 'log', '--grep=a\\\\d+'])`)).toBe(1);
    expect(flagged(`x(['git', 'log', '-E', 'a\\\\w'])`)).toBe(1);
    expect(flagged("x(['git', 'log', '-G', `a\\\\S${n}`])")).toBe(1);
    expect(flagged(`const R = 'a\\\\bb'; x(['git', 'log', '-G', R])`)).toBe(1);
    expect(flagged(`x(['git', 'grep', 'a\\\\sb', '--', '*.ts'])`)).toBe(1);
    expect(flagged(`x(['git', 'log', '-G', pattern])`)).toBe(1);
    expect(flagged(`gitIn({ args: ['log', '-G', '^\\\\s*a'] })`)).toBe(1);
  });

  it('accepts POSIX classes, fixed strings and regexes that never reach git', () => {
    const flagged = (code: string) => gitRegexViolationsOf('probe.ts', code).length;

    expect(flagged(`x(['git', 'log', '-G', '^[[:space:]]*Impl([^[:alnum:]_]|$)'])`)).toBe(0);
    expect(flagged(`x(['git', 'grep', '-q', '-F', '-e', 'a\\\\s'])`)).toBe(0);
    expect(flagged(`x(['git', 'log', '-G', 'implements'])`)).toBe(0);
    expect(flagged(`const r = /^\\s*a\\b/; x(['git', 'status']); y('a\\\\s'.split(/\\s+/))`)).toBe(0);
    expect(flagged(`x(['node', '-e', 'a\\\\s'])`)).toBe(0);
  });
});
