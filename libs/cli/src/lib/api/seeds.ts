import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, posix } from 'path';
import { DEFAULT_CHECKOUT_DIR } from './clone';
import { didYouMean } from './suggest';

export const SEEDS_DIR = `${DEFAULT_CHECKOUT_DIR}/seeds`;
export const SEED_MANIFEST_FILE_NAME = 'seeds.json';
export const CONTAINER_SEEDS_DIR = '/tmp/ethlete-seeds';

/** The commands an API gets from `.ethlete/seeds/<name>/seeds.json`. An `exec` entry of the same name runs instead. */
export const SEED_API_COMMANDS = ['seed', 'fixtures'] as const;

export type Seed = {
  description?: string;
  /** Shell lines, run in order by one `sh` that stops at the first failing line. */
  run: string[];
  env?: Record<string, string>;
};

export type SeedManifest = {
  fixtures?: string[];
  seeds: Record<string, Seed>;
};

export type SeedStep = { label: string; lines: string[]; env: Record<string, string> };

type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

const SEED_NAME = /^[\w-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLineList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((line) => typeof line === 'string' && line.trim() !== '');

const unknownKeys = (value: Record<string, unknown>, known: string[]) =>
  Object.keys(value).filter((key) => !known.includes(key));

const parseSeed = (name: string, value: unknown): Parsed<Seed> => {
  const at = `seeds.${name}`;

  if (!SEED_NAME.test(name)) {
    return { ok: false, problem: `"${name}" is not a seed name. Use letters, digits, "-" and "_".` };
  }

  if (!isRecord(value)) return { ok: false, problem: `${at} must be an object with a "run" list.` };

  const extra = unknownKeys(value, ['description', 'run', 'env']);

  if (extra.length > 0) {
    return { ok: false, problem: `${at} has an unknown key "${extra[0]}". Known keys: description, run, env.` };
  }

  if (!isLineList(value['run'])) return { ok: false, problem: `${at}.run must be a non-empty list of shell lines.` };

  if (value['description'] !== undefined && typeof value['description'] !== 'string') {
    return { ok: false, problem: `${at}.description must be a string.` };
  }

  const env = value['env'];

  if (env !== undefined) {
    const valid =
      isRecord(env) &&
      Object.entries(env).every(([key, entry]) => /^[A-Za-z_]\w*$/.test(key) && typeof entry === 'string');

    if (!valid) {
      return { ok: false, problem: `${at}.env must map variable names to strings.` };
    }
  }

  return {
    ok: true,
    value: {
      run: value['run'],
      description: value['description'],
      env: env as Record<string, string> | undefined,
    },
  };
};

export const parseSeedManifest = (value: unknown): Parsed<SeedManifest> => {
  if (!isRecord(value)) return { ok: false, problem: 'The manifest must be a JSON object.' };

  const extra = unknownKeys(value, ['fixtures', 'seeds']);

  if (extra.length > 0) {
    return { ok: false, problem: `Unknown key "${extra[0]}". Known keys: fixtures, seeds.` };
  }

  const fixtures = value['fixtures'];

  if (fixtures !== undefined && !isLineList(fixtures)) {
    return { ok: false, problem: 'fixtures must be a non-empty list of shell lines.' };
  }

  const rawSeeds = value['seeds'] ?? {};

  if (!isRecord(rawSeeds)) return { ok: false, problem: 'seeds must be an object of named seeds.' };

  const seeds: Record<string, Seed> = {};

  for (const [name, entry] of Object.entries(rawSeeds)) {
    const seed = parseSeed(name, entry);

    if (!seed.ok) return seed;

    seeds[name] = seed.value;
  }

  return { ok: true, value: { fixtures, seeds } };
};

export const seedDirectory = (root: string, name: string) => join(root, SEEDS_DIR, name);

export const seedManifestPath = (name: string) => `${SEEDS_DIR}/${name}/${SEED_MANIFEST_FILE_NAME}`;

export const readSeedManifest = (root: string, name: string): Parsed<SeedManifest> => {
  const path = seedManifestPath(name);
  const absolute = join(root, path);

  if (!existsSync(absolute)) {
    return {
      ok: false,
      problem:
        `The ${name} API has no seeds. Create ${path}:\n\n` +
        `  {\n    "fixtures": ["bin/console doctrine:fixtures:load -n"],\n` +
        `    "seeds": {\n      "demo": { "description": "Demo data", "run": ["php $SEED_DIR/demo.php"] }\n    }\n  }`,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    return { ok: false, problem: `${path} is not valid JSON: ${(error as Error).message}` };
  }

  const manifest = parseSeedManifest(parsed);

  return manifest.ok ? manifest : { ok: false, problem: `${path}: ${manifest.problem}` };
};

export const parseSeedList = (argument: string | undefined) =>
  (argument ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

export const seedSteps = (options: {
  manifest: SeedManifest;
  names: string[];
  withFixtures: boolean;
  api: string;
}): Parsed<SeedStep[]> => {
  const { manifest, names, withFixtures, api } = options;
  const known = Object.keys(manifest.seeds);
  const unknown = names.find((name) => !Object.prototype.hasOwnProperty.call(manifest.seeds, name));

  if (unknown !== undefined) {
    return {
      ok: false,
      problem:
        `The ${api} API has no seed "${unknown}".${didYouMean(unknown, known)}\n\n` +
        `Seeds: ${known.length > 0 ? known.join(', ') : 'none'}`,
    };
  }

  if (withFixtures && !manifest.fixtures) {
    return { ok: false, problem: `${seedManifestPath(api)} declares no fixtures.` };
  }

  const fixtures = withFixtures && manifest.fixtures ? [{ label: 'fixtures', lines: manifest.fixtures, env: {} }] : [];
  const seeds = names.map((name) => {
    const seed = manifest.seeds[name] as Seed;

    return { label: name, lines: seed.run, env: seed.env ?? {} };
  });

  return { ok: true, value: [...fixtures, ...seeds] };
};

export const seedListText = (options: { api: string; manifest: SeedManifest; invocation: string }) => {
  const { api, manifest, invocation } = options;
  const entries = Object.entries(manifest.seeds);
  const width = Math.max(...entries.map(([name]) => name.length), 0);

  if (entries.length === 0) return `${seedManifestPath(api)} declares no seeds.`;

  return [
    `Seeds of the ${api} API`,
    '',
    ...entries.map(([name, seed]) => `  ${name.padEnd(width)}  ${seed.description ?? seed.run.join('; ')}`),
    '',
    `Run them with "${invocation} seed ${api} ${entries.map(([name]) => name).join(',')}".`,
  ].join('\n');
};

export const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const containerSeedDirectory = (api: string) => posix.join(CONTAINER_SEEDS_DIR, api);

export const seedCopyArgs = (service: string, directory: string) => {
  const quoted = shellQuote(directory);

  return ['exec', '-T', service, 'sh', '-c', `rm -rf ${quoted} && mkdir -p ${quoted} && tar -x -C ${quoted}`];
};

export const seedRunArgs = (options: { service: string; directory: string; step: SeedStep; tty: boolean }) => {
  const { service, directory, step, tty } = options;
  const exportLines = Object.entries({ SEED_DIR: directory, ...step.env }).map(
    ([key, value]) => `export ${key}=${shellQuote(value)}`,
  );

  return ['exec', ...(tty ? [] : ['-T']), service, 'sh', '-c', ['set -e', ...exportLines, ...step.lines].join('\n')];
};

const BLOCK = 512;

const octal = (value: number, length: number) => value.toString(8).padStart(length - 1, '0') + '\0';

const splitTarName = (name: string): [string, string] => {
  if (Buffer.byteLength(name) <= 100) return ['', name];

  for (let index = name.indexOf('/'); index !== -1; index = name.indexOf('/', index + 1)) {
    const prefix = name.slice(0, index);
    const rest = name.slice(index + 1);

    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(rest) <= 100) return [prefix, rest];
  }

  throw new Error(`${name} is too long a path for a seed folder.`);
};

const tarHeader = (options: { name: string; mode: number; size: number; mtime: number; directory: boolean }) => {
  const header = Buffer.alloc(BLOCK);
  const [prefix, name] = splitTarName(options.name);

  header.write(name, 0);
  header.write(octal(options.mode, 8), 100);
  header.write(octal(0, 8), 108);
  header.write(octal(0, 8), 116);
  header.write(octal(options.size, 12), 124);
  header.write(octal(options.mtime, 12), 136);
  header.write(' '.repeat(8), 148);
  header.write(options.directory ? '5' : '0', 156);
  header.write('ustar\0', 257);
  header.write('00', 263);
  header.write(prefix, 345);

  const checksum = header.reduce((sum, byte) => sum + byte, 0);

  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);

  return header;
};

/** A ustar archive of everything under `directory`, built in memory so the host needs no `tar` of its own. */
export const tarDirectory = (directory: string) => {
  const blocks: Buffer[] = [];

  const add = (relative: string) => {
    const absolute = join(directory, relative);

    for (const entry of readdirSync(absolute).sort()) {
      const name = relative === '' ? entry : `${relative}/${entry}`;
      const stats = statSync(join(directory, name));
      const mtime = Math.floor(stats.mtimeMs / 1000);

      if (stats.isDirectory()) {
        blocks.push(tarHeader({ name: `${name}/`, mode: 0o755, size: 0, mtime, directory: true }));
        add(name);
      } else if (stats.isFile()) {
        const contents = readFileSync(join(directory, name));

        blocks.push(tarHeader({ name, mode: stats.mode & 0o777, size: contents.length, mtime, directory: false }));
        blocks.push(contents, Buffer.alloc((BLOCK - (contents.length % BLOCK)) % BLOCK));
      }
    }
  };

  add('');
  blocks.push(Buffer.alloc(BLOCK * 2));

  return Buffer.concat(blocks);
};
