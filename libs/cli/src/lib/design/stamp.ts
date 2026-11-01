import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { assetRoot } from './paths';

export const STAMP_PATH = '/__design/stamp';

export const BUILD_INFO_FILE = 'build-info.json';

/** What a design server was started from: the cli version and a hash of its code and frame assets. */
export type BuildStamp = { version: string; build: string };

const filesUnder = (dir: string) =>
  (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => statSync(join(dir, file)).isFile())
    .sort()
    .map((file) => ({ name: file, path: join(dir, file) }));

const builtAtFromFile = (path: string) => {
  try {
    const time = Date.parse((JSON.parse(readFileSync(path, 'utf8')) as { builtAt?: string }).builtAt ?? '');

    return Number.isNaN(time) ? null : time;
  } catch {
    return null;
  }
};

const inspectBuild = (dirs: { code: string; assets: string; manifest: string; info: string }) => {
  const hash = createHash('sha256');
  let builtAt = 0;

  for (const dir of [dirs.code, dirs.assets]) {
    for (const file of filesUnder(dir)) {
      hash.update(file.name).update(readFileSync(file.path));
      builtAt = Math.max(builtAt, statSync(file.path).mtimeMs);
    }
  }

  const manifest = JSON.parse(readFileSync(dirs.manifest, 'utf8')) as { version?: string };

  return {
    stamp: { version: manifest.version ?? 'unknown', build: hash.digest('hex').slice(0, 12) } satisfies BuildStamp,
    builtAt: builtAtFromFile(dirs.info) ?? Math.round(builtAt),
  };
};

/** The stamp of the cli on disk now. A server takes it once at start, so a reinstall moves the two apart. */
export const buildStampOf = (assets = assetRoot()): BuildStamp =>
  inspectBuild({
    code: __dirname,
    assets,
    manifest: resolve(__dirname, '../../../package.json'),
    info: resolve(__dirname, '../../../', BUILD_INFO_FILE),
  }).stamp;

/** The stamp and build time (ms) of the cli at `__dirname`: `build-info.json` when the build wrote one, else the newest file time. */
export const buildInfoOf = (assets = assetRoot()) =>
  inspectBuild({
    code: __dirname,
    assets,
    manifest: resolve(__dirname, '../../../package.json'),
    info: resolve(__dirname, '../../../', BUILD_INFO_FILE),
  });

/** The stamp and newest file time of the cli package installed at `packageRoot`, or null when it has no built design code. */
export const installedBuildInfoOf = (packageRoot: string) => {
  try {
    return inspectBuild({
      code: join(packageRoot, 'src/lib/design'),
      assets: join(packageRoot, 'design'),
      manifest: join(packageRoot, 'package.json'),
      info: join(packageRoot, BUILD_INFO_FILE),
    });
  } catch {
    return null;
  }
};

const isStamp = (value: unknown): value is BuildStamp =>
  typeof (value as BuildStamp | null)?.version === 'string' && typeof (value as BuildStamp | null)?.build === 'string';

/**
 * Node connects `localhost` to 127.0.0.1 alone, while Vite may listen on ::1 alone, so a local
 * base is also tried at each loopback address.
 */
const stampUrlsOf = (base: string) => {
  const url = new URL(STAMP_PATH, base);

  if (url.hostname !== 'localhost') return [url.href];

  return ['localhost', '127.0.0.1', '[::1]'].map((hostname) => Object.assign(new URL(url), { hostname }).href);
};

/**
 * Why the server at `base` cannot be checked against: unreachable, or started from a different
 * cli than this one. Null when it is the same build.
 */
export const serverProblemOf = async (options: { base: string; own: BuildStamp }): Promise<string | null> => {
  const { base, own } = options;
  let response: Response | null = null;
  let failure: unknown = null;

  for (const url of stampUrlsOf(base)) {
    try {
      response = await fetch(url);
      break;
    } catch (error) {
      failure ??= error;
    }
  }

  if (!response) {
    const reason = String((failure as { cause?: unknown } | null)?.cause ?? failure);

    return `NO SERVER - nothing answers at ${base} (${reason}). Start it with \`et design\`.`;
  }

  const served = await response.json().catch(() => null);

  if (!isStamp(served)) {
    return `STALE SERVER - the server at ${base} predates this cli and reports no build stamp. Restart it.`;
  }

  if (served.version === own.version && served.build === own.build) return null;

  return (
    `STALE SERVER - the server at ${base} runs @ethlete/cli ${served.version} (build ${served.build}), ` +
    `this check ${own.version} (build ${own.build}). Restart it.`
  );
};
