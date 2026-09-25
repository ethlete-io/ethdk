import { existsSync } from 'fs';
import { join } from 'path';
import { Manifest } from './packages';

export type PackageManagerName = 'yarn' | 'pnpm' | 'bun' | 'npm';

export type PackageManager = {
  name: PackageManagerName;
  /** The command that installs what `package.json` declares. */
  install: string[];
  /** How this manager runs a binary from `node_modules`, for example `yarn nx`. */
  run: string[];
};

const MANAGERS: Record<PackageManagerName, PackageManager> = {
  yarn: { name: 'yarn', install: ['yarn', 'install'], run: ['yarn'] },
  pnpm: { name: 'pnpm', install: ['pnpm', 'install'], run: ['pnpm', 'exec'] },
  bun: { name: 'bun', install: ['bun', 'install'], run: ['bunx'] },
  npm: { name: 'npm', install: ['npm', 'install'], run: ['npx'] },
};

const LOCKFILES: [string, PackageManagerName][] = [
  ['yarn.lock', 'yarn'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
];

const declaredName = (manifest: Manifest | undefined, userAgent: string | undefined) => {
  const declared = manifest?.packageManager ?? userAgent;

  return declared
    ? (Object.keys(MANAGERS) as PackageManagerName[]).find((name) => declared.startsWith(name))
    : undefined;
};

/**
 * The package manager this repo uses: what `packageManager` declares, else the lockfile that is there,
 * else npm. `et update` runs the install itself, so it has to be the same one the repo already uses.
 */
export const detectPackageManager = (options: {
  root: string;
  manifest?: Manifest;
  env?: NodeJS.ProcessEnv;
}): PackageManager => {
  const { root, manifest, env = process.env } = options;
  const declared = declaredName(manifest, env['npm_config_user_agent']);

  if (declared) return MANAGERS[declared];

  const found = LOCKFILES.find(([fileName]) => existsSync(join(root, fileName)));

  return MANAGERS[found?.[1] ?? 'npm'];
};

const INJECTED_REGISTRY = /^npm_config_(@[^:]+:)?registry$/i;

/**
 * The environment for the install `et update` spawns. Inside a package manager script, yarn 1 exports
 * its own default registry as `npm_config_registry`, which the child install would read over the
 * repo's `.npmrc` and `.yarnrc`. Dropping it lets the child read the repo's config, as it does when
 * `et` runs outside a script.
 */
export const installEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  if (env['npm_lifecycle_event'] === undefined) return env;

  return Object.fromEntries(Object.entries(env).filter(([key]) => !INJECTED_REGISTRY.test(key)));
};

/** The command that runs an `nx` from this repo, for example `yarn nx generate …`. */
export const nxCommand = (options: { manager: PackageManager; args: readonly string[] }) => [
  ...options.manager.run,
  'nx',
  ...options.args,
];
