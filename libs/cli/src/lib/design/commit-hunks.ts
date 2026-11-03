import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { basename, isAbsolute, relative, resolve } from 'path';
import { jsonLayoutOf } from './json-layout';
import { partKeyOf } from './system/resolve-product';
import { argsOf } from './system/sketch/cli-args';
import { parseTarget } from './system/sketch/sketch';

export const COMMIT_HUNKS_USAGE =
  'commit-hunks <file> --part <layer>/<name> [--part <layer>/<name>]… [--message <text>]';

type Entry = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * HEAD's content of a part-keyed JSON file with only the entries of `parts` taken from the working tree: an object
 * keyed by part, or a list of entries with a `part` field. Entries of any other part stay as HEAD holds them.
 */
export const withPartHunks = (options: { head: unknown; work: unknown; parts: string[] }): unknown | string => {
  const { head, work, parts } = options;

  if (Array.isArray(head) && Array.isArray(work)) {
    const owned = (entry: unknown) =>
      isEntry(entry) && typeof entry['part'] === 'string' && parts.includes(entry['part']);

    return [
      ...head.filter((entry) => !owned(entry) || work.some((candidate) => same(candidate, entry))),
      ...work.filter((entry) => owned(entry) && !head.some((candidate) => same(candidate, entry))),
    ];
  }

  if (isEntry(head) && isEntry(work)) {
    const composed: Entry = { ...head };

    for (const part of parts) {
      if (part in work) composed[part] = work[part];
      else delete composed[part];
    }

    return composed;
  }

  return 'the file is neither a JSON object keyed by part nor a list of entries with a part field';
};

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const fail = (message: string) => {
  console.error(message);

  return 1;
};

/**
 * `et design commit-hunks <file> --part <p>` commits only the entries of part `p` of a shared JSON file (`go.json`,
 * `merged.json`, `accepted.json`, ...): HEAD plus those entries is committed for that path, and the working file keeps
 * every other session's uncommitted entries.
 */
export const designCommitHunks = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--part', '--message']);
  const [asked, ...extra] = typeof args === 'string' ? [] : args.positional;
  const asParts = (typeof args === 'string' ? [] : (args.repeated['--part'] ?? [])).map(parseTarget);
  const bad = asParts.find((part) => typeof part === 'string');

  if (typeof args === 'string' || !asked || extra.length > 0 || asParts.length === 0) {
    return fail(`usage: ${invocation} ${COMMIT_HUNKS_USAGE}`);
  }

  if (typeof bad === 'string') return fail(bad);

  const parts = asParts.flatMap((part) => (typeof part === 'string' ? [] : [partKeyOf(part)]));
  const absolute = isAbsolute(asked) ? asked : resolve(target, asked);
  const file = relative(target, absolute);

  let original: string;
  let work: unknown;
  let head: unknown;

  try {
    original = readFileSync(absolute, 'utf8');
    work = JSON.parse(original);
  } catch (error) {
    return fail(`${file} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    head = JSON.parse(git(target, ['show', `HEAD:./${file}`]));
  } catch {
    head = Array.isArray(work) ? [] : {};
  }

  const composed = withPartHunks({ head, work, parts });

  if (typeof composed === 'string') return fail(`${file}: ${composed}`);
  if (same(composed, head)) {
    console.log(`${file} holds no uncommitted entry of ${parts.join(', ')}`);

    return 0;
  }

  const message = args.values['--message'] ?? `chore(repo): Record ${parts.join(', ')} in ${basename(file)}`;

  writeFileSync(absolute, jsonLayoutOf(composed));

  try {
    git(target, ['commit', '-m', message, '--', file]);
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };

    return fail(`${output.stdout ?? ''}${output.stderr ?? ''}${file} was not committed`.trim());
  } finally {
    writeFileSync(absolute, original);
  }

  console.log(`committed ${parts.join(', ')} of ${file}; the other entries stay in the working tree`);

  return 0;
};
