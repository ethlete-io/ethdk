import { createHash, randomUUID } from 'crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  utimesSync,
  writeSync,
} from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { writeCacheEntry } from './cache-entry';
import { isRunning } from './is-running';
import { PartAddress, PartMark, Picture, TextAmbient } from './shot';

/** The part of a shot address that decides which files a shot draws from. */
export type StoredAddress = Pick<PartAddress, 'product' | 'part' | 'sketch' | 'props'>;

/** Pictures kept on disk across server restarts, each served only while every file it was drawn from is unchanged. */
export type ShotStore = {
  read: (key: string, address: StoredAddress) => Picture | null;
  write: (key: string, drawn: { address: StoredAddress; picture: Picture }) => void;
  drop: (key: string) => void;
  /** Marks `key` as drawn by this process until `release`, or null while another live process draws it. */
  claim: (key: string) => DrawClaim | null;
  /**
   * Waits up to `ms` for the draw of `key` another process holds: the picture once it is stored for this checkout's
   * files, else the claim of a lock that was released, of a dead process or older than `ms`, else a timeout.
   */
  waitFor: (key: string, wait: { address: StoredAddress; ms: number }) => Promise<SharedDraw>;
};

export type DrawClaim = { release: () => void };

export type SharedDraw =
  | { picture: Picture }
  | { claim: DrawClaim | null; why: 'released' | 'owner gone' | 'too old' | 'timeout'; waitedMs: number };

type DrawLock = { pid: number; at: number; token: string };

type Entry = {
  key: string;
  scope: string;
  inputs: [string, string | null][];
  png: string;
  marks: PartMark[];
  markup?: string;
  ambient?: TextAmbient;
};

/** The shot store folder under the work root, one for every checkout that shares the `node_modules` it lies in. */
export const SHOT_STORE_DIR = 'part-shots';

const SHOT_STORE_LIMIT = 512 * 1024 * 1024;

const STALE_TEMP_MS = 60_000;

const ENTRY_SUFFIX = '.json';

const VARIANTS_PER_KEY = 4;

const LOCK_NAME = 'draw.lock';

const LOCK_POLL_MS = 100;

const isEntry = (value: unknown): value is Entry => {
  const entry = value as Partial<Entry> | null;

  return (
    typeof entry?.key === 'string' &&
    typeof entry.scope === 'string' &&
    Array.isArray(entry.inputs) &&
    typeof entry.png === 'string' &&
    Array.isArray(entry.marks)
  );
};

const isLock = (value: unknown): value is DrawLock => {
  const lock = value as Partial<DrawLock> | null;

  return typeof lock?.pid === 'number' && typeof lock.at === 'number' && typeof lock.token === 'string';
};

const lockAt = (path: string): DrawLock | 'none' | 'unreadable' => {
  try {
    const lock: unknown = JSON.parse(readFileSync(path, 'utf8'));

    return isLock(lock) ? lock : 'unreadable';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'none' : 'unreadable';
  }
};

const realOf = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

/**
 * A disk store for part pictures under `dir`, which servers of several checkouts may share. `inputsOf` names every file
 * a picture was drawn from once it is drawn, or null when they are unknown; `scopeOf` describes how the product resolves
 * its imports. A file or path inside `checkout` is stored relative to it, so a checkout whose files read the same gets
 * the picture another checkout drew. Each key keeps a few variants, one per set of file contents; an entry is a miss
 * once its scope differs or one of its files reads differently in this checkout. The oldest entries go past `limit` bytes.
 */
export const createShotStore = (options: {
  dir: string;
  salt: string;
  checkout: string;
  inputsOf: (address: StoredAddress) => string[] | null;
  scopeOf: (address: StoredAddress) => string;
  limit?: number;
  pollMs?: number;
}): ShotStore => {
  const { dir, salt, inputsOf, scopeOf } = options;
  const limit = options.limit ?? SHOT_STORE_LIMIT;
  const pollMs = options.pollMs ?? LOCK_POLL_MS;
  const hashes = new Map<string, { stamp: string; hash: string }>();
  const used = new Map<string, string>();
  let sizes: Map<string, number> | null = null;
  const checkoutGone = () => !existsSync(options.checkout);

  const checkouts = [...new Set([resolve(options.checkout), realOf(options.checkout)])].sort(
    (a, b) => b.length - a.length,
  );
  const storedPathOf = (file: string) => {
    const path = resolve(file);
    const inside = checkouts.find((root) => path.startsWith(`${root}${sep}`));

    return inside ? relative(inside, path) : path;
  };
  const storedScopeOf = (address: StoredAddress) =>
    checkouts.reduce(
      (scope, root) => scope.split(JSON.stringify(`${root}${sep}`).slice(1, -1)).join('<checkout>/'),
      scopeOf(address),
    );

  const keyDirOf = (key: string) => createHash('sha1').update(salt).update('\n').update(key).digest('hex');

  const hashOf = (stored: string) => {
    const file = isAbsolute(stored) ? stored : resolve(options.checkout, stored);

    try {
      const stat = statSync(file, { bigint: true });
      const stamp = `${stat.size} ${stat.mtimeNs} ${stat.ctimeNs}`;
      const known = hashes.get(file);

      if (known?.stamp === stamp) return known.hash;

      const hash = createHash('sha1').update(readFileSync(file)).digest('hex');

      hashes.set(file, { stamp, hash });

      return hash;
    } catch {
      return null;
    }
  };

  const dropDeadLock = (path: string) => {
    const lock = lockAt(path);

    if (typeof lock === 'object' && !isRunning(lock.pid)) rmSync(path, { force: true });
  };

  const lockOf = (key: string) => join(dir, keyDirOf(key), LOCK_NAME);

  const claim = (key: string): DrawClaim | null => {
    const path = lockOf(key);
    const token = randomUUID();

    if (checkoutGone()) return null;

    try {
      mkdirSync(dirname(path), { recursive: true });

      const fd = openSync(path, 'wx');

      try {
        writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now(), token } satisfies DrawLock));
      } finally {
        closeSync(fd);
      }
    } catch {
      return null;
    }

    let held = true;

    return {
      release: () => {
        if (!held) return;

        held = false;

        const lock = lockAt(path);

        if (typeof lock === 'object' && lock.token === token) rmSync(path, { force: true });
      },
    };
  };

  const sizesOf = () => {
    if (sizes) return sizes;

    sizes = new Map();
    mkdirSync(dir, { recursive: true });

    for (const name of readdirSync(dir, { recursive: true }) as string[]) {
      const stat = statSync(join(dir, name), { throwIfNoEntry: false });

      if (!stat?.isFile()) continue;
      if (name.endsWith(ENTRY_SUFFIX)) sizes.set(name, stat.size);
      else if (basename(name) === LOCK_NAME) dropDeadLock(join(dir, name));
      else if (Date.now() - stat.mtimeMs > STALE_TEMP_MS) rmSync(join(dir, name), { force: true });
    }

    return sizes;
  };

  const mtimeOf = (name: string) => statSync(join(dir, name), { throwIfNoEntry: false })?.mtimeMs ?? 0;

  const remove = (known: Map<string, number>, name: string) => {
    known.delete(name);
    rmSync(join(dir, name), { force: true });
  };

  const evict = (known: Map<string, number>) => {
    let total = [...known.values()].reduce((sum, size) => sum + size, 0);

    if (total <= limit) return;

    const oldest = [...known.keys()].map((name) => ({ name, at: mtimeOf(name) })).sort((a, b) => a.at - b.at);

    for (const { name } of oldest) {
      if (total <= limit) return;

      total -= known.get(name) ?? 0;
      remove(known, name);
    }
  };

  const variantsOf = (key: string) => {
    const keyDir = keyDirOf(key);

    try {
      return readdirSync(join(dir, keyDir))
        .filter((name) => name.endsWith(ENTRY_SUFFIX))
        .map((name) => join(keyDir, name));
    } catch {
      return [];
    }
  };

  const pictureOf = (name: string, wanted: { key: string; scope: string }): Picture | null => {
    try {
      const entry: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));

      if (!isEntry(entry) || entry.key !== wanted.key || entry.scope !== wanted.scope) return null;
      if (entry.inputs.some(([file, hash]) => hashOf(file) !== hash)) return null;

      return {
        png: Buffer.from(entry.png, 'base64'),
        marks: entry.marks,
        ...(typeof entry.markup === 'string' ? { markup: entry.markup } : {}),
        ...(entry.ambient ? { ambient: entry.ambient } : {}),
      };
    } catch {
      return null;
    }
  };

  const read = (key: string, address: StoredAddress) => {
    const scope = storedScopeOf(address);

    for (const name of variantsOf(key)) {
      const picture = pictureOf(name, { key, scope });

      if (!picture) continue;

      const now = new Date();

      try {
        utimesSync(join(dir, name), now, now);
      } catch {
        return null;
      }
      used.set(key, name);

      return picture;
    }

    return null;
  };

  const waitFor = async (key: string, { address, ms }: { address: StoredAddress; ms: number }): Promise<SharedDraw> => {
    const path = lockOf(key);
    const started = Date.now();

    for (;;) {
      const picture = read(key, address);

      if (picture) return { picture };

      const lock = lockAt(path);
      const waitedMs = Date.now() - started;
      const ownerGone = typeof lock === 'object' && !isRunning(lock.pid);
      const tooOld =
        typeof lock === 'object'
          ? Date.now() - lock.at >= ms
          : lock === 'unreadable' && Date.now() - mtimeOf(relative(dir, path)) >= ms;
      const stale = ownerGone || tooOld;

      if (stale) {
        const still = lockAt(path);

        if (typeof lock !== 'object' || (typeof still === 'object' && still.token === lock.token))
          rmSync(path, { force: true });
      }
      if (lock === 'none' || stale) {
        const claimed = claim(key);

        if (claimed) {
          const stored = read(key, address);

          if (!stored)
            return { claim: claimed, why: ownerGone ? 'owner gone' : tooOld ? 'too old' : 'released', waitedMs };

          claimed.release();

          return { picture: stored };
        }
      }
      if (waitedMs >= ms) return { claim: null, why: 'timeout', waitedMs };

      await delay(pollMs);
    }
  };

  return {
    read,
    write: (key, { address, picture }) => {
      try {
        const files = inputsOf(address);

        if (!files || checkoutGone()) return;

        const scope = storedScopeOf(address);
        const inputs = [...new Set(files.map(storedPathOf))]
          .sort()
          .map((file): [string, string | null] => [file, hashOf(file)]);
        const variant = createHash('sha1').update(scope).update('\n').update(JSON.stringify(inputs)).digest('hex');
        const name = join(keyDirOf(key), `${variant}${ENTRY_SUFFIX}`);
        const entry: Entry = {
          key,
          scope,
          inputs,
          png: picture.png.toString('base64'),
          marks: picture.marks,
          ...(picture.markup === undefined ? {} : { markup: picture.markup }),
          ...(picture.ambient === undefined ? {} : { ambient: picture.ambient }),
        };
        const text = JSON.stringify(entry);
        const known = sizesOf();

        if (!writeCacheEntry(join(dir, dirname(name)), { name: `${variant}${ENTRY_SUFFIX}`, text })) return;

        known.set(name, Buffer.byteLength(text));
        used.set(key, name);

        const others = variantsOf(key)
          .filter((other) => other !== name)
          .map((other) => ({ other, at: mtimeOf(other) }))
          .sort((a, b) => b.at - a.at);

        for (const { other } of others.slice(VARIANTS_PER_KEY - 1)) remove(known, other);
        evict(known);
      } catch {
        return;
      }
    },
    drop: (key) => {
      const name = used.get(key);

      if (!name) return;

      used.delete(key);
      if (sizes) remove(sizes, name);
      else rmSync(join(dir, name), { force: true });
    },
    claim,
    waitFor,
  };
};
