import { createHash } from 'crypto';
import { Dirent, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'fs';
import { dirname, join, relative } from 'path';
import { writeCacheEntry } from '../cache-entry';

export type CachedAppShot = { app: Buffer };

/** App pictures of compare on disk, each under the hash of every input that draws it. */
export type AppShotCache = {
  read: (key: string) => CachedAppShot | null;
  write: (key: string, shot: CachedAppShot) => void;
};

/** The cache folder name of the design pictures compare and its action check draw. */
export const COMPARE_DESIGN_SHOTS = 'compare-design-shots';

export const COMPARE_APP_SHOTS = 'compare-app-shots';

const APP_SHOT_LIMIT = 256 * 1024 * 1024;

const ENTRY_SUFFIX = '.json';

/** The hash of every file under `root`, by path and content: the built harness app a compare draws. */
export const builtAppHashOf = (root: string) => {
  const hash = createHash('sha256');
  const files = (readdirSync(root, { recursive: true, withFileTypes: true }) as Dirent[])
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();

  for (const file of files) hash.update(relative(root, file)).update('\0').update(readFileSync(file)).update('\0');

  return hash.digest('hex');
};

/** The version of the Playwright package compare draws with, which pins its Chromium. */
export const browserVersionOf = (from: string | undefined) => {
  if (!from) return '';

  for (let dir = dirname(from); dir !== dirname(dir); dir = dirname(dir)) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };

      if (manifest.name && manifest.version) return `${manifest.name}@${manifest.version}`;
    } catch {
      continue;
    }
  }

  return from;
};

export const cacheKeyOf = (inputs: unknown) => createHash('sha256').update(JSON.stringify(inputs)).digest('hex');

/** A disk cache of app pictures under `dir`; the oldest entries go past `limit` bytes. Reading and writing never throw. */
/** @internal Removes the least recently used `.json` entries in `dir` until they hold at most `limit` bytes. */
export const evictOldestPast = (dir: string, limit: number) => {
  try {
    const entries = readdirSync(dir)
      .filter((name) => name.endsWith(ENTRY_SUFFIX))
      .map((name) => ({ name, ...statSync(join(dir, name)) }))
      .sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);

    for (const entry of entries) {
      if (total <= limit) return;

      total -= entry.size;
      rmSync(join(dir, entry.name), { force: true });
    }
  } catch {
    return;
  }
};

export const createAppShotCache = (dir: string, limit = APP_SHOT_LIMIT): AppShotCache => {
  const evict = () => evictOldestPast(dir, limit);

  return {
    read: (key) => {
      const path = join(dir, `${key}${ENTRY_SUFFIX}`);

      try {
        const entry = JSON.parse(readFileSync(path, 'utf8')) as { key?: unknown; app?: unknown };

        if (entry.key !== key || typeof entry.app !== 'string') return null;

        const now = new Date();

        utimesSync(path, now, now);

        return { app: Buffer.from(entry.app, 'base64') };
      } catch {
        return null;
      }
    },
    write: (key, shot) => {
      if (
        writeCacheEntry(dir, {
          name: `${key}${ENTRY_SUFFIX}`,
          text: JSON.stringify({ key, app: shot.app.toString('base64') }),
        })
      )
        evict();
    },
  };
};
