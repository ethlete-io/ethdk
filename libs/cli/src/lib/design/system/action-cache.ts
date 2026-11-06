import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import { join } from 'path';

/** The cache folder name of the action check results compare keeps per state. */
export const COMPARE_ACTIONS = 'compare-actions';

const ENTRY_LIMIT = 4096;

const ENTRY_SUFFIX = '.json';

/** A design input an action check read while it ran: a design picture, an embedded part's states, or the embedders. */
export type ActionDep =
  | { kind: 'draw'; state: string; opened: Record<string, unknown> | null }
  | { kind: 'expected'; owner: string; state: string }
  | { kind: 'embedders' };

export type ActionCacheEntry = { key: string; value: unknown; deps: { dep: ActionDep; print: string }[] };

/** Action check results on disk, each under the hash of its fixed inputs. Reading and writing never throw. */
export type ActionCache = {
  read: (key: string) => ActionCacheEntry | null;
  write: (entry: ActionCacheEntry) => void;
};

/** A disk cache of action check results under `dir`; the oldest entries go past `limit` entries. */
export const createActionCache = (dir: string, limit = ENTRY_LIMIT): ActionCache => {
  let temps = 0;

  const evict = () => {
    const entries = readdirSync(dir)
      .filter((name) => name.endsWith(ENTRY_SUFFIX))
      .map((name) => ({ name, mtimeMs: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    for (const entry of entries.slice(0, Math.max(0, entries.length - limit)))
      rmSync(join(dir, entry.name), { force: true });
  };

  return {
    read: (key) => {
      const path = join(dir, `${key}${ENTRY_SUFFIX}`);

      try {
        const entry = JSON.parse(readFileSync(path, 'utf8')) as Partial<ActionCacheEntry>;

        if (entry.key !== key || !Array.isArray(entry.deps)) return null;

        const now = new Date();

        utimesSync(path, now, now);

        return entry as ActionCacheEntry;
      } catch {
        return null;
      }
    },
    write: (entry) => {
      const temp = join(dir, `.${entry.key}.${process.pid}.${(temps += 1)}.tmp`);

      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(temp, JSON.stringify(entry));
        renameSync(temp, join(dir, `${entry.key}${ENTRY_SUFFIX}`));
        evict();
      } catch {
        rmSync(temp, { force: true });
      }
    },
  };
};

/**
 * The value `run` returns for `key`, kept in `cache` while every input `run` tracked prints the same through `printOf`.
 * A `keep: false` result is not kept. Without a cache `run` always runs.
 */
export const cachedActionsOf = async <T>(options: {
  cache: ActionCache | null;
  key: string;
  printOf: (dep: ActionDep) => Promise<string>;
  run: (track: (dep: ActionDep, print: string) => void) => Promise<{ value: T; keep: boolean }>;
}): Promise<{ value: T; hit: boolean }> => {
  const { cache, key, printOf, run } = options;
  const kept = cache?.read(key) ?? null;

  if (kept) {
    const prints = await Promise.all(kept.deps.map(({ dep }) => printOf(dep).catch(() => null)));

    if (prints.every((print, at) => print === kept.deps[at]?.print)) return { value: kept.value as T, hit: true };
  }

  const deps = new Map<string, { dep: ActionDep; print: string }>();
  const { value, keep } = await run((dep, print) => deps.set(JSON.stringify(dep), { dep, print }));

  if (cache && keep) cache.write({ key, value, deps: [...deps.values()] });

  return { value, hit: false };
};
