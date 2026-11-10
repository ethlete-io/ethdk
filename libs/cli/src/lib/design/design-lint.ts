import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { spawnPlain } from '../plain-output';
import { callsRootOf } from './design-config';
import { addedBaselineNamesOf } from './system/baseline-history';
import { sharedDirOf, Sketch, sourceFilesIn, variantDirOf } from './system/sketch/sketch';
import { binaryOf, trim } from './typecheck';

export const LINT_BASELINE_FILE = 'lint-baseline.json';

/** Per part file (its path in the product, a variant file under its part's path), the count of each rule's old findings. */
export type LintBaseline = Record<string, Record<string, number>>;

export type LintFinding = { file: string; line: number; column: number; rule: string; message: string };

type EslintMessage = { ruleId: string | null; line?: number; column?: number; message: string };

type EslintResult = { filePath: string; messages: EslintMessage[] };

const LINTED = /(?<!\.d)\.(?:ts|mts|cts|js|mjs|cjs)$/u;

const CONFIG_FILES = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'].map((ext) => `eslint.config.${ext}`);

export const isLintedFile = (file: string) => LINTED.test(file);

const hasEslintConfig = (from: string): boolean => {
  if (CONFIG_FILES.some((name) => existsSync(resolve(from, name)))) return true;

  const parent = dirname(from);

  return parent !== from && hasEslintConfig(parent);
};

/**
 * ESLint's findings on `files` with the config the checkout `target` lints with, or `null` when it installs no eslint
 * or has no config, or why eslint failed.
 */
export const lintFindingsOf = (options: { target: string; files: string[] }): LintFinding[] | null | string => {
  const { target } = options;
  const files = options.files.filter(isLintedFile);

  if (files.length === 0 || !hasEslintConfig(target)) return [];

  const eslint = binaryOf({ target, pkg: 'eslint', bin: 'eslint' });

  if (!eslint) return null;

  const run = spawnPlain([process.execPath, eslint, '--format', 'json', '--no-warn-ignored', ...files], {
    cwd: target,
    maxBuffer: 1 << 26,
  });

  if (run.status !== 0 && run.status !== 1)
    return `eslint failed (${run.status ?? run.signal}): ${trim(run.stderr || run.stdout || String(run.error ?? ''))}`;

  return (JSON.parse(run.stdout) as EslintResult[]).flatMap((result) =>
    result.messages.map((message) => ({
      file: result.filePath,
      line: message.line ?? 0,
      column: message.column ?? 0,
      rule: message.ruleId ?? 'parse',
      message: message.message,
    })),
  );
};

/** The lintable files under `productDir` that differ from HEAD or git does not track yet, of `part` only when given. */
export const changedLintFilesOf = (options: { target: string; productDir: string; part?: string }) => {
  const { target, productDir, part } = options;
  const git = (args: string[]) => {
    const run = spawnPlain(['git', ...args, '--', productDir], { cwd: target, maxBuffer: 1 << 26 });

    return run.status === 0 ? run.stdout.split('\n').filter(Boolean) : [];
  };
  const paths = [
    ...git(['diff', '--name-only', '--relative', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];

  return [...new Set(paths)]
    .map((path) => resolve(target, path))
    .filter((file) => isLintedFile(file) && existsSync(file))
    .filter((file) => !part || lintKeyOf(productDir, file).startsWith(`${part}/`));
};

/** The lintable files of `variants` of `sketch` and of its `shared/` folder. */
export const variantLintFilesOf = (sketch: Sketch, variants: string[]) =>
  [...variants.map((variant) => variantDirOf(sketch, variant)), sharedDirOf(sketch)]
    .flatMap(sourceFilesIn)
    .filter(isLintedFile);

/** The baseline key of `file` in the product at `productDir`: a variant file counts as the part file it replaces. */
export const lintKeyOf = (productDir: string, file: string) => {
  const path = relative(productDir, file).split(sep).join('/');
  const sketched = /^sketches\/[^/]+\/([^/]+)\/(.+)$/u.exec(path);

  if (!sketched) return path;

  return sketched[1] === 'shared' ? `shared/${sketched[2]}` : (sketched[2] ?? path);
};

export const lintBaselineFileOf = (productDir: string) => resolve(productDir, LINT_BASELINE_FILE);

const baselineOf = (text: string): LintBaseline => {
  try {
    return JSON.parse(text) as LintBaseline;
  } catch {
    return {};
  }
};

export const readLintBaseline = (productDir: string): LintBaseline => {
  const file = lintBaselineFileOf(productDir);

  return existsSync(file) ? baselineOf(readFileSync(file, 'utf8')) : {};
};

const identitiesOf = (text: string): [string, string][] =>
  Object.entries(baselineOf(text)).flatMap(([key, rules]) =>
    Object.entries(rules).flatMap(([rule, count]) =>
      Array.from({ length: count }, (_, index): [string, string] => [`${key} ${rule}`, `${key} ${rule} ${index}`]),
    ),
  );

/** The lines of the entries of the product's lint baseline that grew after it was first committed: it may only shrink. */
export const grownLintBaselineLinesOf = (productDir: string) =>
  [...new Set(addedBaselineNamesOf({ file: lintBaselineFileOf(productDir), identitiesOf }))].map(
    (name) =>
      `LINT-BASELINE ${relative(productDir, lintBaselineFileOf(productDir))}: ${name} grew - fix the warning, the baseline only shrinks`,
  );

const groupsOf = (productDir: string, findings: LintFinding[]) => {
  const groups = new Map<string, LintFinding[]>();

  for (const finding of findings) {
    const group = `${lintKeyOf(productDir, finding.file)}\n${finding.rule}`;

    groups.set(group, [...(groups.get(group) ?? []), finding]);
  }

  return groups;
};

/** One line per finding of a file and rule that fires more often than the baseline allows. */
export const newLintLinesOf = (options: { target: string; productDir: string; findings: LintFinding[] }) => {
  const { target, productDir, findings } = options;
  const baseline = readLintBaseline(productDir);

  return [...groupsOf(productDir, findings).entries()].flatMap(([group, found]) => {
    const [key = '', rule = ''] = group.split('\n');
    const allowed = baseline[key]?.[rule] ?? 0;

    if (found.length <= allowed) return [];

    const over = allowed > 0 ? ` (${found.length} in the file, the baseline allows ${allowed})` : '';

    return found.map(
      (finding) =>
        `LINT ${relative(target, finding.file)}:${finding.line}:${finding.column} ${finding.rule}: ${finding.message}${over}`,
    );
  });
};

/**
 * Lowers each baseline count of the linted part files (not variants) to what fires now and drops the entries of files
 * that are gone. Answers a line per change.
 */
export const shrinkLintBaseline = (options: { productDir: string; linted: string[]; findings: LintFinding[] }) => {
  const { productDir, linted, findings } = options;
  const baseline = readLintBaseline(productDir);
  const lintedKeys = new Set(
    linted
      .filter((file) => !relative(productDir, file).startsWith(`sketches${sep}`))
      .map((file) => lintKeyOf(productDir, file)),
  );
  const counts = new Map([...groupsOf(productDir, findings).entries()].map(([group, found]) => [group, found.length]));
  const lines: string[] = [];
  const next: LintBaseline = {};

  for (const [key, rules] of Object.entries(baseline)) {
    const gone = !existsSync(resolve(productDir, key));

    for (const [rule, count] of Object.entries(rules)) {
      const now = gone ? 0 : lintedKeys.has(key) ? Math.min(count, counts.get(`${key}\n${rule}`) ?? 0) : count;

      if (now !== count) lines.push(`lint baseline: ${key} ${rule} ${count} -> ${now}`);
      if (now > 0) next[key] = { ...next[key], [rule]: now };
    }
  }

  if (lines.length > 0) writeFileSync(lintBaselineFileOf(productDir), `${JSON.stringify(next, null, 2)}\n`);

  return lines;
};

/**
 * Lints `files` of the product at `productDir` and answers the lines that fail: eslint's own failure, a grown
 * baseline, and each finding over the baseline. With `shrink`, it first lowers the baseline to what fires now.
 */
export const lintGateLinesOf = (options: {
  target: string;
  productDir: string;
  files: string[];
  shrink?: boolean;
}): string[] => {
  const { target, productDir, files, shrink } = options;
  const findings = lintFindingsOf({ target, files });

  if (typeof findings === 'string') return [`LINT ${findings}`];

  const shrunk = shrink && findings ? shrinkLintBaseline({ productDir, linted: files, findings }) : [];

  for (const line of shrunk) console.log(line);

  return [...grownLintBaselineLinesOf(productDir), ...newLintLinesOf({ target, productDir, findings: findings ?? [] })];
};

/**
 * The lint gate of the call files that differ from HEAD, of the call at `slug` only when given, against the calls'
 * own baseline in `.ethlete/design/calls`.
 */
export const callLintGateLinesOf = (options: { target: string; slug?: string; shrink?: boolean }) => {
  const { target, slug, shrink } = options;
  const callsDir = callsRootOf(target);
  const files = changedLintFilesOf({ target, productDir: slug ? resolve(callsDir, slug) : callsDir });

  return lintGateLinesOf({ target, productDir: callsDir, files, shrink });
};
