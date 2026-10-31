import { createHash } from 'crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PartAddress, PartMark, Picture } from './shot';

/** The part of a shot address that decides which files a shot draws from. */
export type StoredAddress = Pick<PartAddress, 'product' | 'part' | 'sketch' | 'props'>;

/** Pictures kept on disk across server restarts, each served only while every file it was drawn from is unchanged. */
export type ShotStore = {
  read: (key: string, address: StoredAddress) => Picture | null;
  write: (key: string, drawn: { address: StoredAddress; picture: Picture }) => void;
  drop: (key: string) => void;
};

type Entry = {
  key: string;
  scope: string;
  inputs: [string, string | null][];
  png: string;
  marks: PartMark[];
  markup?: string;
};

const SHOT_STORE_LIMIT = 512 * 1024 * 1024;

const STALE_TEMP_MS = 60_000;

const ENTRY_SUFFIX = '.json';

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

/**
 * A disk store for part pictures under `dir`. `inputsOf` names every file a picture was drawn from once it is drawn,
 * or null when they are unknown; `scopeOf` describes how the product resolves its imports. An entry is a miss
 * once its scope differs or one of its files reads differently. The oldest entries go past `limit` bytes.
 */
export const createShotStore = (options: {
  dir: string;
  salt: string;
  inputsOf: (address: StoredAddress) => string[] | null;
  scopeOf: (address: StoredAddress) => string;
  limit?: number;
}): ShotStore => {
  const { dir, salt, inputsOf, scopeOf } = options;
  const limit = options.limit ?? SHOT_STORE_LIMIT;
  const hashes = new Map<string, { stamp: string; hash: string }>();
  let sizes: Map<string, number> | null = null;
  let temps = 0;

  const nameOf = (key: string) =>
    `${createHash('sha1').update(salt).update('\n').update(key).digest('hex')}${ENTRY_SUFFIX}`;

  const hashOf = (file: string) => {
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

  const sizesOf = () => {
    if (sizes) return sizes;

    sizes = new Map();
    mkdirSync(dir, { recursive: true });

    for (const name of readdirSync(dir)) {
      const stat = statSync(join(dir, name));

      if (name.endsWith(ENTRY_SUFFIX)) sizes.set(name, stat.size);
      else if (Date.now() - stat.mtimeMs > STALE_TEMP_MS) rmSync(join(dir, name), { force: true });
    }

    return sizes;
  };

  const evict = (known: Map<string, number>) => {
    let total = [...known.values()].reduce((sum, size) => sum + size, 0);

    if (total <= limit) return;

    const oldest = [...known.keys()]
      .map((name) => ({ name, at: statSync(join(dir, name), { throwIfNoEntry: false })?.mtimeMs ?? 0 }))
      .sort((a, b) => a.at - b.at);

    for (const { name } of oldest) {
      if (total <= limit) return;

      total -= known.get(name) ?? 0;
      known.delete(name);
      rmSync(join(dir, name), { force: true });
    }
  };

  return {
    read: (key, address) => {
      const path = join(dir, nameOf(key));

      try {
        const entry: unknown = JSON.parse(readFileSync(path, 'utf8'));

        if (!isEntry(entry) || entry.key !== key || entry.scope !== scopeOf(address)) return null;
        if (entry.inputs.some(([file, hash]) => hashOf(file) !== hash)) return null;

        const now = new Date();

        utimesSync(path, now, now);

        return {
          png: Buffer.from(entry.png, 'base64'),
          marks: entry.marks,
          ...(typeof entry.markup === 'string' ? { markup: entry.markup } : {}),
        };
      } catch {
        return null;
      }
    },
    write: (key, { address, picture }) => {
      const name = nameOf(key);
      const temp = join(dir, `.${name}.${process.pid}.${(temps += 1)}.tmp`);

      try {
        const files = inputsOf(address);

        if (!files) return;

        const entry: Entry = {
          key,
          scope: scopeOf(address),
          inputs: [...new Set(files)].sort().map((file) => [file, hashOf(file)]),
          png: picture.png.toString('base64'),
          marks: picture.marks,
          ...(picture.markup === undefined ? {} : { markup: picture.markup }),
        };
        const text = JSON.stringify(entry);
        const known = sizesOf();

        writeFileSync(temp, text);
        renameSync(temp, join(dir, name));
        known.set(name, Buffer.byteLength(text));
        evict(known);
      } catch {
        rmSync(temp, { force: true });
      }
    },
    drop: (key) => {
      const name = nameOf(key);

      sizes?.delete(name);
      rmSync(join(dir, name), { force: true });
    },
  };
};
