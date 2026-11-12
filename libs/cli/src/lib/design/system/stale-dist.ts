import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, utimesSync } from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { DesignConfig } from '../design-config';
import { readFreshLibBuild } from './lib-build-lock';
import { DEFAULT_RENDER_MODULES, mapPackage, renderPackagesOf } from '../render-packages';

const SKIPPED_DIRS = new Set(['node_modules', 'scenarios', 'stories', '__fixtures__']);
const SKIPPED_FILE = /\.(spec|stories)\.ts$/;

const newestMtimeOf = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((newest, entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? newest : Math.max(newest, newestMtimeOf(path));

    return entry.isFile() && !SKIPPED_FILE.test(entry.name) ? Math.max(newest, statSync(path).mtimeMs) : newest;
  }, 0);

const ethleteDependenciesOf = (dir: string): string[] => {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;

  return ['dependencies', 'peerDependencies'].flatMap((field) =>
    Object.keys((manifest[field] as Record<string, string> | undefined) ?? {}).filter((name) =>
      name.startsWith('@ethlete/'),
    ),
  );
};

type StaleLib = { specifier: string; name: string; source: string; dir: string };

const checkoutLibsOf = (options: { target: string; config: DesignConfig | null }): StaleLib[] => {
  const { target, config } = options;
  const packages = renderPackagesOf({ target, config });
  const queue = [...(config?.render?.modules ?? DEFAULT_RENDER_MODULES)];
  const seen = new Set<string>();
  const libs: StaleLib[] = [];

  while (queue.length > 0) {
    const specifier = queue.shift() as string;

    if (seen.has(specifier)) continue;

    seen.add(specifier);

    const mapped = mapPackage({ specifier, packages, target });

    if (!mapped || mapped.dir.split(/[\\/]/).includes('node_modules') || !existsSync(join(mapped.dir, 'package.json')))
      continue;

    queue.push(...ethleteDependenciesOf(mapped.dir));

    const name = basename(mapped.dir);
    const source = resolve(target, 'libs', name, 'src');

    if (existsSync(source)) libs.push({ specifier, name, source, dir: mapped.dir });
  }

  return libs;
};

/**
 * The checkout lib build folders the render modules map to that do not exist, each with the command that builds it.
 * A checkout with a source `libs/<name>` but no `dist/libs/<name>` cannot render its drawings.
 */
export const missingDistOf = (options: { target: string; config: DesignConfig | null }) => {
  const { target, config } = options;
  const packages = renderPackagesOf({ target, config });

  return (config?.render?.modules ?? DEFAULT_RENDER_MODULES).flatMap((specifier) => {
    const mapped = mapPackage({ specifier, packages, target });

    if (!mapped || mapped.dir.split(/[\\/]/).includes('node_modules')) return [];

    const name = basename(mapped.dir);

    return existsSync(join(mapped.dir, 'package.json')) || !existsSync(resolve(target, 'libs', name, 'src'))
      ? []
      : [`${relative(target, mapped.dir)} is missing - run ${libBuildCommandOf(name)}`];
  });
};

export const staleLibsOf = (options: { target: string; config: DesignConfig | null }) =>
  checkoutLibsOf(options).filter(({ source, dir }) => newestMtimeOf(source) > newestMtimeOf(dir));

/** Changes whenever a checkout lib build folder the drawings load from is rebuilt. */
export const libBuildStampOf = (options: { target: string; config: DesignConfig | null }) =>
  checkoutLibsOf(options)
    .map(({ dir }) => `${dir}:${newestMtimeOf(dir)}`)
    .join('|');

/** The shell command that rebuilds the build folder of the checkout lib `name`. */
export const libBuildCommandOf = (name: string) => `NX_NO_CLOUD=true npx nx build ${name} --skip-nx-cache`;

/**
 * One warning line per checkout lib the drawings load from a build folder (the render modules and their `@ethlete/*`
 * dependencies) whose `libs/<name>/src` changed after that build, naming the command that rebuilds it.
 */
export const staleDistWarningsOf = (options: { target: string; config: DesignConfig | null }): string[] =>
  staleLibsOf(options).map(
    ({ specifier, name, source, dir }) =>
      `WARNING STALE BUILD ${specifier} - ${relative(options.target, source)} changed after ${relative(options.target, dir)} was built; the drawings use the old build - run npx nx build ${name}`,
  );

export type LibBuildRunner = (options: { workspace: string; name: string; dir: string }) => boolean;

const workspaceOwning = (options: { dir: string; target: string }) => {
  let current = realpathSync(options.dir);

  while (!existsSync(join(current, 'nx.json'))) {
    const parent = dirname(current);

    if (parent === current) return options.target;

    current = parent;
  }

  return current;
};

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** One line with the tail of a failed lib build's output, so a caller that keeps only the last lines still sees why. */
export const buildFailureLineOf = (options: {
  name: string;
  output: string;
  status: number | null;
  signal: string | null;
}) => {
  const { name, output, status, signal } = options;
  const tail = output
    .replace(ANSI, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12)
    .join(' / ');

  return `BUILD OUTPUT ${name} (exit ${status ?? signal}): ${tail.length > 2000 ? `...${tail.slice(-2000)}` : tail || '(none)'}`;
};

const runLibBuild: LibBuildRunner = ({ workspace, name, dir }) => {
  const result = spawnSync('npx', ['nx', 'build', name, '--skip-nx-cache'], {
    cwd: workspace,
    env: { ...process.env, NX_NO_CLOUD: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`;

  process.stderr.write(output);

  if (result.status !== 0) {
    console.error(buildFailureLineOf({ name, output, status: result.status, signal: result.signal }));

    return false;
  }

  // A cache hit whose outputs already match leaves the build folder untouched, which would still read as stale.
  const now = new Date();
  utimesSync(join(dir, 'package.json'), now, now);

  return true;
};

/**
 * Rebuilds every stale checkout lib the drawings load from a build folder, then checks again. Answers false, after
 * printing the build command to run, when a build fails or a lib is still stale - a drawing must not use an old build.
 * Each build runs in the Nx workspace that owns the build folder, which differs from `target` when its `dist` is a link.
 */
export const rebuildStaleDist = (options: { target: string; config: DesignConfig | null; build?: LibBuildRunner }) => {
  const { target, config, build = runLibBuild } = options;
  const stale = staleLibsOf({ target, config });

  if (stale.length === 0) return true;

  for (const lib of [...stale].reverse()) {
    console.error(`STALE BUILD ${lib.specifier} - rebuilding: ${libBuildCommandOf(lib.name)}`);

    if (!build({ workspace: workspaceOwning({ dir: lib.dir, target }), name: lib.name, dir: lib.dir })) {
      console.error(
        `REFUSED STALE BUILD ${lib.specifier} - the build failed; fix it and run ${libBuildCommandOf(lib.name)}`,
      );

      return false;
    }
  }

  const still = staleLibsOf({ target, config });

  for (const lib of still)
    console.error(
      `REFUSED STALE BUILD ${lib.specifier} - ${relative(target, lib.dir)} is still older than ${relative(target, lib.source)} after the rebuild; run ${libBuildCommandOf(lib.name)}`,
    );

  return still.length === 0;
};

/**
 * Runs `rebuildStaleDist` under the lib build lock of the checkout and keeps the build read until `release`, so a
 * concurrent design call waits instead of rebuilding a lib folder this one still renders from.
 */
export const readFreshDist = async (options: {
  target: string;
  config: DesignConfig | null;
  build?: LibBuildRunner;
}) => {
  const { target } = options;

  if (!existsSync(join(target, 'dist/libs'))) return { ok: rebuildStaleDist(options), release: () => undefined };

  return readFreshLibBuild({
    directory: join(target, 'tmp/design-lib-build'),
    stale: () => staleLibsOf(options).length > 0,
    rebuild: () => rebuildStaleDist(options),
  });
};
