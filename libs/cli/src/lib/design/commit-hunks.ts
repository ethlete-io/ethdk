import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { jsonLayoutOf } from './json-layout';
import { partKeyOf } from './system/resolve-product';
import { argsOf } from './system/sketch/cli-args';
import { parseTarget } from './system/sketch/sketch';

export const COMMIT_HUNKS_USAGE =
  'commit-hunks <file> --part <layer>/<name> [--part <layer>/<name>]… [--id <capability>]… [--message <text>]';

type Entry = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sortedByKey = (value: Entry): Entry =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, item: unknown) => (isEntry(item) ? sortedByKey(item) : item));

const PART_KEY = /^[^/]+\/[^/]+$/u;

const REFUSAL =
  'is not split per part: it is neither an object keyed by <layer>/<name>, a list of entries with a part field, nor a capabilities list (--id); commit the whole file with `yarn commit` when no other session edits it';

const idOf = (entry: unknown) => (isEntry(entry) && typeof entry['id'] === 'string' ? entry['id'] : null);

const mergeById = (lists: { head: unknown[]; work: unknown[] }, ids: string[]) => {
  const { head, work } = lists;
  const owned = (entry: unknown) => ids.includes(idOf(entry) ?? '');
  const taken = work.filter(owned);
  const merged = head.map((entry) => (owned(entry) ? (taken.find((t) => idOf(t) === idOf(entry)) ?? null) : entry));

  return [...merged.filter((entry) => entry !== null), ...taken.filter((t) => !head.some((h) => idOf(h) === idOf(t)))];
};

/**
 * HEAD's content of a shared design JSON file with only the entries of `parts` (or, for `capabilities.json`, of
 * `ids`) taken from the working tree: an object keyed by part, a list of entries with a `part` field, or an object
 * whose `capabilities` list holds entries with an `id`. A string is the refusal for any other shape.
 */
export const withPartHunks = (options: {
  head: unknown;
  work: unknown;
  parts: string[];
  ids?: string[];
}): unknown | string => {
  const { head, work, parts, ids = [] } = options;

  if (isEntry(head) && isEntry(work) && Array.isArray(head['capabilities']) && Array.isArray(work['capabilities'])) {
    if (ids.length === 0) return 'holds capabilities, which are split per id: pass --id <capability>';

    return { ...head, capabilities: mergeById({ head: head['capabilities'], work: work['capabilities'] }, ids) };
  }

  if (ids.length > 0) return 'has no capabilities list, so --id does not apply';

  if (Array.isArray(head) && Array.isArray(work)) {
    const owned = (entry: unknown) =>
      isEntry(entry) && typeof entry['part'] === 'string' && parts.includes(entry['part']);

    if ([...head, ...work].some((entry) => !isEntry(entry) || typeof entry['part'] !== 'string')) return REFUSAL;

    return [
      ...head.filter((entry) => !owned(entry) || work.some((candidate) => same(candidate, entry))),
      ...work.filter((entry) => owned(entry) && !head.some((candidate) => same(candidate, entry))),
    ];
  }

  if (isEntry(head) && isEntry(work)) {
    if ([...Object.keys(head), ...Object.keys(work)].some((key) => !PART_KEY.test(key))) return REFUSAL;

    const composed: Entry = { ...head };

    for (const part of parts) {
      if (part in work) composed[part] = work[part];
      else delete composed[part];
    }

    return sortedByKey(composed);
  }

  return REFUSAL;
};

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const LOCK_TRIES = 10;

const gitLocked = (error: unknown) => /index\.lock/u.test(String((error as { stderr?: unknown }).stderr ?? ''));

const wait = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const gitRetrying = (cwd: string, args: string[]) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return git(cwd, args);
    } catch (error) {
      if (attempt >= LOCK_TRIES || !gitLocked(error)) throw error;

      wait(attempt * 100);
    }
  }
};

const waitForIndexLock = async (target: string) => {
  const module = join(target, 'tools/scripts/commit-wait.mjs');

  if (!existsSync(module)) return;

  const { waitForLock } = (await import(pathToFileURL(module).href)) as {
    waitForLock: (lock: string) => Promise<void>;
  };

  await waitForLock(join(git(target, ['rev-parse', '--absolute-git-dir']).trim(), 'index.lock'));
};

const fail = (message: string, code = 1) => {
  console.error(message);

  return code;
};

/**
 * `et design commit-hunks <file> --part <p>` commits only the entries of part `p` of a shared JSON file (`merged.json`,
 * `ready.json`, ...): HEAD plus those entries is committed for that path, and the working file keeps
 * every other session's uncommitted entries.
 */
export const designCommitHunks = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, { values: ['--part', '--id', '--message'], switches: [] });
  const [asked, ...extra] = typeof args === 'string' ? [] : args.positional;
  const asParts = (typeof args === 'string' ? [] : (args.repeated['--part'] ?? [])).map(parseTarget);
  const ids = typeof args === 'string' ? [] : (args.repeated['--id'] ?? []);
  const bad = asParts.find((part) => typeof part === 'string');

  if (typeof args === 'string' || !asked || extra.length > 0 || asParts.length + ids.length === 0) {
    return fail(`${typeof args === 'string' ? `${args}\n` : ''}usage: ${invocation} ${COMMIT_HUNKS_USAGE}`, 2);
  }

  if (typeof bad === 'string') return fail(bad, 2);

  const parts = asParts.flatMap((part) => (typeof part === 'string' ? [] : [partKeyOf(part)]));
  const absolute = isAbsolute(asked) ? asked : resolve(target, asked);
  const file = relative(target, absolute);

  let original: string;
  let work: unknown;
  let head: unknown;
  let headText = '';

  try {
    original = readFileSync(absolute, 'utf8');
    work = JSON.parse(original);
  } catch (error) {
    return fail(`${file} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    headText = git(target, ['show', `HEAD:./${file}`]);
    head = JSON.parse(headText);
  } catch {
    head = Array.isArray(work) ? [] : {};
  }

  const composed = withPartHunks({ head, work, parts, ids });

  const names = [...parts, ...ids];

  if (typeof composed === 'string') return fail(`${file} ${composed}`);
  if (canonical(composed) === canonical(head)) {
    const order =
      canonical(work) === canonical(head) && !same(work, head) ? ' (the rest differs in key order only)' : '';

    console.log(`${file} holds no uncommitted entry of ${names.join(', ')}${order}`);

    return 0;
  }

  const message = args.values['--message'] ?? `chore(repo): Record ${names.join(', ')} in ${basename(file)}`;

  await waitForIndexLock(target);
  writeFileSync(
    absolute,
    headText === `${JSON.stringify(head, null, 2)}\n`
      ? `${JSON.stringify(composed, null, 2)}\n`
      : jsonLayoutOf(composed),
  );

  try {
    gitRetrying(target, ['commit', '-m', message, '--', file]);
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };

    return fail(`${output.stdout ?? ''}${output.stderr ?? ''}${file} was not committed`.trim());
  } finally {
    writeFileSync(absolute, original);
  }

  const rest =
    canonical(work) !== canonical(composed)
      ? 'the other entries stay in the working tree'
      : same(work, composed)
        ? 'nothing else differs from HEAD'
        : 'the rest differs from HEAD in key order only (order only)';

  console.log(`committed ${names.join(', ')} of ${file}; ${rest}`);

  return 0;
};
