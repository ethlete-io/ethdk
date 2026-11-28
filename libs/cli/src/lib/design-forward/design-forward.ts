import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { posix, resolve, win32 } from 'path';

/** Names the design entry of a Studio that lives where no install path below looks, such as an AppImage. */
export const STUDIO_DESIGN_ENV = 'ETHLETE_STUDIO_DESIGN';

/** The `productName` in apps/ethlete-studio/src-tauri/tauri.conf.json, which names Tauri's install folders. */
const PRODUCT_NAME = 'Ethlete Studio';

/** Where the Tauri config bundles the design runtime under the resource folder, and its entry. */
const RUNTIME_ENTRY = ['cli-runtime', 'src', 'bin.js'];

/**
 * The design entries an installed Studio can carry on `platform`, in the order they are tried: the
 * resource folders Tauri gives a deb or rpm on Linux, an app bundle on macOS and an NSIS install on Windows.
 */
export const studioDesignEntries = (options: { platform: NodeJS.Platform; env: NodeJS.ProcessEnv; home: string }) => {
  const { platform, env, home } = options;
  const named = env[STUDIO_DESIGN_ENV];

  if (named) return [named];

  if (platform === 'win32') {
    return [env['LOCALAPPDATA'], env['ProgramFiles']]
      .filter((dir): dir is string => !!dir)
      .map((dir) => win32.join(dir, PRODUCT_NAME, ...RUNTIME_ENTRY));
  }

  if (platform === 'darwin') {
    const resources = posix.join(`${PRODUCT_NAME}.app`, 'Contents', 'Resources', ...RUNTIME_ENTRY);

    return [posix.join('/Applications', resources), posix.join(home, 'Applications', resources)];
  }

  return [posix.join('/usr/lib', PRODUCT_NAME, ...RUNTIME_ENTRY)];
};

export type DesignRoute =
  { kind: 'in-process' } | { kind: 'forward'; entry: string } | { kind: 'missing'; message: string };

/**
 * How `et design` runs: in this process when the cli is a build inside the SDK checkout (its own
 * tooling drives that build), else through the design tool of the installed Studio.
 */
export const designRouteOf = (options: {
  buildDir: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
  exists?: (path: string) => boolean;
}): DesignRoute => {
  const { buildDir, env, exists = existsSync } = options;
  const entries = studioDesignEntries(options);

  if (!env[STUDIO_DESIGN_ENV] && isSdkBuild(buildDir, exists)) return { kind: 'in-process' };

  const entry = entries.find((path) => exists(path));

  if (entry) return { kind: 'forward', entry };

  return {
    kind: 'missing',
    message: [
      '`et design` runs the design tool of Ethlete Studio, and no installed Studio was found. Looked for:',
      ...entries.map((path) => `  ${path}`),
      '',
      'Install Studio from https://github.com/ethlete-io/ethdk/releases, or point',
      `${STUDIO_DESIGN_ENV} at the cli-runtime/src/bin.js of a Studio installed elsewhere.`,
    ].join('\n'),
  };
};

/** A build in `<checkout>/dist/libs/cli`, or the pinned copy of one Studio starts in development. */
const isSdkBuild = (buildDir: string, exists: (path: string) => boolean) =>
  exists(resolve(buildDir, 'pinned-commit')) || exists(resolve(buildDir, '../../../libs/cli/src/index.ts'));

/** Runs `node <entry> design …` with this process's stdio, so an MCP client speaks to the Studio tool directly. */
export const forwardDesign = (options: { entry: string; argv: string[]; root: string }): Promise<number> =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [options.entry, 'design', ...options.argv], {
      cwd: options.root,
      stdio: 'inherit',
    });

    const relay = (signal: NodeJS.Signals) => child.kill(signal);

    process.on('SIGINT', relay).on('SIGTERM', relay);
    child.once('error', fail);
    child.once('exit', (code, signal) => {
      process.off('SIGINT', relay).off('SIGTERM', relay);
      done(code ?? (signal ? 1 : 0));
    });
  });
