import { createHash, randomUUID } from 'crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
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
import { CompareBoxes } from './system/compare-boxes';

/** The part of a shot address that decides which files a shot draws from. */
export type StoredAddress = Pick<PartAddress, 'product' | 'part' | 'sketch' | 'props'>;

/** Pictures kept on disk across server restarts, each served only while every file it was drawn from is unchanged. */
export type ShotStore = {
  read: (key: string, address: StoredAddress) => Picture | null;
  /** Like `read`, also answering a picture an older picture code drew from the same files, whose size only is current. */
  readAnyCode: (key: string, address: StoredAddress) => Picture | null;
  write: (key: string, drawn: { address: StoredAddress; picture: Picture }) => void;
  /** A JSON value `writeKept` kept under `key`, served on the same terms as a picture, or null. */
  readKept: (key: string, address: StoredAddress) => unknown;
  /** Keeps a JSON value computed from the files `address` draws, under a key no picture uses. */
  writeKept: (key: string, computed: { address: StoredAddress; kept: unknown }) => void;
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

type Head = { key: string; code?: string; scope: string; inputs: [string, string | null][] };

type Body = { marks: PartMark[]; boxes?: CompareBoxes; markup?: string; ambient?: TextAmbient; kept?: unknown };

type Entry = Head & Body & { png: Buffer };

type LegacyEntry = Head & Body & { png: string };

type Wanted = { key: string; scope: string; anyCode: boolean };

type Found = { name: string; entry: Entry | null };

/** The shot store folder under the work root, one for every checkout that shares the `node_modules` it lies in. */
export const SHOT_STORE_DIR = 'part-shots';

const SHOT_STORE_LIMIT = 512 * 1024 * 1024;

const STALE_TEMP_MS = 60_000;

const ENTRY_SUFFIX = '.shot';

const LEGACY_SUFFIX = '.json';

const ENTRY_MAGIC = Buffer.from('ETSHOT1\n');

const PREFIX_BYTES = ENTRY_MAGIC.length + 8;

const VARIANTS_PER_KEY = 4;

const LOCK_NAME = 'draw.lock';

const LOCK_POLL_MS = 100;

const isHead = (value: unknown): value is Head => {
  const head = value as Partial<Head> | null;

  return typeof head?.key === 'string' && typeof head.scope === 'string' && Array.isArray(head.inputs);
};

const isBody = (value: unknown): value is Body => Array.isArray((value as Partial<Body> | null)?.marks);

const isLegacyEntry = (value: unknown): value is LegacyEntry =>
  isHead(value) && isBody(value) && typeof (value as Partial<LegacyEntry>).png === 'string';

const isEntryName = (name: string) => name.endsWith(ENTRY_SUFFIX) || name.endsWith(LEGACY_SUFFIX);

const entryBytesOf = ({ key, code, scope, inputs, png, ...body }: Entry) => {
  const head = Buffer.from(JSON.stringify({ key, code, scope, inputs } satisfies Head));
  const rest = Buffer.from(JSON.stringify(body satisfies Body));
  const prefix = Buffer.alloc(PREFIX_BYTES);

  ENTRY_MAGIC.copy(prefix);
  prefix.writeUInt32BE(head.length, ENTRY_MAGIC.length);
  prefix.writeUInt32BE(rest.length, ENTRY_MAGIC.length + 4);

  return Buffer.concat([prefix, head, rest, png]);
};

const bytesAt = (fd: number, { at, length }: { at: number; length: number }) => {
  const bytes = Buffer.alloc(length);

  for (let read = 0; read < length;) {
    const got = readSync(fd, bytes, read, length - read, at + read);

    if (got === 0) throw new Error('design-explore: shot store entry ends early');

    read += got;
  }

  return bytes;
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
  /** The picture code a read entry must be drawn by; an `anyCode` read ignores it. */
  code?: string;
  checkout: string;
  inputsOf: (address: StoredAddress) => string[] | null;
  scopeOf: (address: StoredAddress) => string;
  limit?: number;
  pollMs?: number;
}): ShotStore => {
  const { dir, salt, inputsOf, scopeOf } = options;
  const code = options.code ?? '';
  const limit = options.limit ?? SHOT_STORE_LIMIT;
  const pollMs = options.pollMs ?? LOCK_POLL_MS;
  const hashes = new Map<string, { stamp: string; hash: string }>();
  const stamps = new Map<string, string | null>();
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

  const statStampOf = (file: string) => {
    try {
      const stat = statSync(file, { bigint: true });

      return `${stat.size} ${stat.mtimeNs} ${stat.ctimeNs}`;
    } catch {
      return null;
    }
  };

  // A stamp holds for the rest of the event-loop turn, so a file written and checked again in the same turn reads
  // its earlier stamp; a write's own hashes pass `fresh`.
  const stampOf = (file: string, fresh: boolean) => {
    if (fresh) return statStampOf(file);

    const seen = stamps.get(file);

    if (seen !== undefined) return seen;
    if (stamps.size === 0) setImmediate(() => stamps.clear()).unref();

    const stamp = statStampOf(file);

    stamps.set(file, stamp);

    return stamp;
  };

  const hashOf = (stored: string, fresh = false) => {
    const file = isAbsolute(stored) ? stored : resolve(options.checkout, stored);
    const stamp = stampOf(file, fresh);

    if (stamp === null) return null;

    try {
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
      if (isEntryName(name)) sizes.set(name, stat.size);
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
        .filter(isEntryName)
        .map((name) => join(keyDir, name));
    } catch {
      return [];
    }
  };

  const matches = (head: Head, wanted: Wanted) =>
    head.key === wanted.key &&
    head.scope === wanted.scope &&
    (wanted.anyCode || (head.code ?? '') === code) &&
    head.inputs.every(([file, hash]) => hashOf(file) === hash);

  const persist = (name: string, entry: Entry) => {
    const bytes = entryBytesOf(entry);
    const known = sizesOf();

    if (!writeCacheEntry(join(dir, dirname(name)), { name: basename(name), text: bytes })) return false;

    known.set(name, bytes.length);

    return true;
  };

  const migrated = (legacy: string, entry: Entry) => {
    const name = `${legacy.slice(0, -LEGACY_SUFFIX.length)}${ENTRY_SUFFIX}`;

    if (checkoutGone() || !persist(name, entry)) return legacy;

    remove(sizesOf(), legacy);

    return name;
  };

  const legacyEntryOf = (name: string, wanted: Wanted): Found => {
    try {
      const entry: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));

      if (!isLegacyEntry(entry)) return { name, entry: null };

      const current = { ...entry, png: Buffer.from(entry.png, 'base64') };

      return { name: migrated(name, current), entry: matches(entry, wanted) ? current : null };
    } catch {
      return { name, entry: null };
    }
  };

  const entryOf = (name: string, wanted: Wanted): Found => {
    if (name.endsWith(LEGACY_SUFFIX)) return legacyEntryOf(name, wanted);

    let fd: number | null = null;

    try {
      fd = openSync(join(dir, name), 'r');

      const prefix = bytesAt(fd, { at: 0, length: PREFIX_BYTES });

      if (!prefix.subarray(0, ENTRY_MAGIC.length).equals(ENTRY_MAGIC)) return { name, entry: null };

      const headLength = prefix.readUInt32BE(ENTRY_MAGIC.length);
      const bodyLength = prefix.readUInt32BE(ENTRY_MAGIC.length + 4);
      const head: unknown = JSON.parse(bytesAt(fd, { at: PREFIX_BYTES, length: headLength }).toString('utf8'));

      if (!isHead(head) || !matches(head, wanted)) return { name, entry: null };

      const restAt = PREFIX_BYTES + headLength;
      const rest = bytesAt(fd, { at: restAt, length: fstatSync(fd).size - restAt });
      const body: unknown = JSON.parse(rest.subarray(0, bodyLength).toString('utf8'));

      return { name, entry: isBody(body) ? { ...body, ...head, png: rest.subarray(bodyLength) } : null };
    } catch {
      return { name, entry: null };
    } finally {
      if (fd !== null) closeSync(fd);
    }
  };

  const pictureOf = (entry: Entry): Picture => ({
    png: entry.png,
    marks: entry.marks,
    ...(entry.boxes ? { boxes: entry.boxes } : {}),
    ...(typeof entry.markup === 'string' ? { markup: entry.markup } : {}),
    ...(entry.ambient ? { ambient: entry.ambient } : {}),
  });

  const readOf = ({ key, address, anyCode }: { key: string; address: StoredAddress; anyCode: boolean }) => {
    const scope = storedScopeOf(address);

    for (const variant of variantsOf(key)) {
      const { name, entry } = entryOf(variant, { key, scope, anyCode });

      if (!entry) continue;
      if (anyCode) return entry;

      const now = new Date();

      try {
        utimesSync(join(dir, name), now, now);
      } catch {
        return null;
      }
      used.set(key, name);

      return entry;
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

  const read = (key: string, address: StoredAddress) => {
    const entry = readOf({ key, address, anyCode: false });

    return entry ? pictureOf(entry) : null;
  };

  const keep = (key: string, { address, fields }: { address: StoredAddress; fields: Body & { png: Buffer } }) => {
    try {
      const files = inputsOf(address);

      if (!files || checkoutGone()) return;

      const scope = storedScopeOf(address);
      const inputs = [...new Set(files.map(storedPathOf))]
        .sort()
        .map((file): [string, string | null] => [file, hashOf(file, true)]);
      const variant = createHash('sha1')
        .update(code)
        .update('\n')
        .update(scope)
        .update('\n')
        .update(JSON.stringify(inputs))
        .digest('hex');
      const name = join(keyDirOf(key), `${variant}${ENTRY_SUFFIX}`);
      const legacy = join(keyDirOf(key), `${variant}${LEGACY_SUFFIX}`);
      const known = sizesOf();

      if (!persist(name, { ...fields, key, code, scope, inputs })) return;

      remove(known, legacy);
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
  };

  return {
    read,
    readAnyCode: (key, address) => {
      const entry = readOf({ key, address, anyCode: true });

      return entry ? pictureOf(entry) : null;
    },
    write: (key, { address, picture }) =>
      keep(key, {
        address,
        fields: {
          png: picture.png,
          marks: picture.marks,
          ...(picture.boxes === undefined ? {} : { boxes: picture.boxes }),
          ...(picture.markup === undefined ? {} : { markup: picture.markup }),
          ...(picture.ambient === undefined ? {} : { ambient: picture.ambient }),
        },
      }),
    readKept: (key, address) => readOf({ key, address, anyCode: false })?.kept ?? null,
    writeKept: (key, { address, kept }) => keep(key, { address, fields: { png: Buffer.alloc(0), marks: [], kept } }),
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
