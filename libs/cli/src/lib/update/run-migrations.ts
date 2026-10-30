import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Migration } from './migration-manifest';
import { PackageManager, PackageManagerName, installEnv, nxCommand, spawnPackageManager } from './package-manager';
import { PendingMigration } from './plan';

export type MigrationState = 'applied' | 'failed' | 'unsupported' | 'task' | 'planned';

export type MigrationOutcome = {
  pending: PendingMigration;
  state: MigrationState;
  /** Why it did not apply, for a state other than `applied`. */
  reason?: string;
};

/** Nx runs the auto migrations, so a repo without it gets the command printed instead. */
export const hasNx = (root: string) =>
  existsSync(join(root, 'node_modules', 'nx', 'package.json')) && existsSync(join(root, 'nx.json'));

/** The `nx generate` arguments for one auto migration. Non-interactive: an update must not stop to ask. */
export const generatorArgs = (options: { migration: Migration; dryRun: boolean }) => {
  const { migration, dryRun } = options;

  return [
    'generate',
    migration.generator ?? '',
    '--interactive=false',
    ...Object.entries(migration.options ?? {}).map(([key, value]) => `--${key}=${String(value)}`),
    ...(dryRun ? ['--dry-run'] : []),
  ];
};

export const runAutoMigration = (options: {
  root: string;
  manager: PackageManager;
  pending: PendingMigration;
  dryRun: boolean;
}): MigrationOutcome => {
  const { root, manager, pending, dryRun } = options;
  const [binary, ...args] = nxCommand({
    manager,
    args: generatorArgs({ migration: pending.migration, dryRun }),
  });

  if (binary === undefined) return { pending, state: 'failed', reason: 'no command to run the generator with' };

  const result = spawnPackageManager({ binary, args, spawn: { cwd: root, stdio: 'inherit' } });

  if (result.error) return { pending, state: 'failed', reason: result.error.message };

  if (result.status !== 0) return { pending, state: 'failed', reason: `${binary} exited with ${result.status}` };

  return { pending, state: dryRun ? 'planned' : 'applied' };
};

export const runInstall = (options: { root: string; manager: PackageManager; env?: NodeJS.ProcessEnv }) => {
  const { root, manager, env } = options;
  const [binary, ...args] = manager.install;

  if (binary === undefined) return { ok: false, reason: 'no install command' };

  const result = spawnPackageManager({ binary, args, spawn: { cwd: root, stdio: 'inherit', env: installEnv(env) } });

  if (result.error) return { ok: false, reason: result.error.message };

  if (result.status !== 0) return { ok: false, reason: `${manager.install.join(' ')} exited with ${result.status}` };

  return { ok: true };
};

const ADD_DEV_COMMANDS: Record<PackageManagerName, string[]> = {
  yarn: ['yarn', 'add', '--dev'],
  pnpm: ['pnpm', 'add', '--save-dev'],
  bun: ['bun', 'add', '--dev'],
  npm: ['npm', 'install', '--save-dev'],
};

const isInstalled = (options: { root: string; name: string }) =>
  existsSync(join(options.root, 'node_modules', options.name, 'package.json'));

const peerRange = (options: { root: string; packageName: string; name: string }) => {
  try {
    const manifest = JSON.parse(
      readFileSync(join(options.root, 'node_modules', options.packageName, 'package.json'), 'utf8'),
    ) as { peerDependencies?: Record<string, string> };

    return manifest.peerDependencies?.[options.name];
  } catch {
    return undefined;
  }
};

const missingRequirement = (options: { root: string; migration: Migration }) =>
  options.migration.requires?.find((name) => !isInstalled({ root: options.root, name }));

/**
 * The packages the pending generators import that this repo lacks, as `add` specs at the range the migrating
 * package's `peerDependencies` names, for example `ts-morph@^28.0.0`.
 */
export const missingRequirements = (options: { root: string; pending: readonly PendingMigration[] }) => {
  const specs = new Map<string, string>();

  for (const { packageName, migration } of options.pending) {
    if (migration.kind !== 'auto') continue;

    for (const name of migration.requires ?? []) {
      if (specs.has(name) || isInstalled({ root: options.root, name })) continue;

      const range = peerRange({ root: options.root, packageName, name });

      specs.set(name, range ? `${name}@${range}` : name);
    }
  }

  return [...specs.values()];
};

/** Adds the packages the pending generators need as dev dependencies, with the repo's own package manager. */
export const installRequirements = (options: { root: string; manager: PackageManager; specs: readonly string[] }) => {
  const { root, manager, specs } = options;
  const [binary, ...args] = [...ADD_DEV_COMMANDS[manager.name], ...specs];
  const command = [binary, ...args].join(' ');

  if (binary === undefined) return { ok: false, command, reason: 'no command to add packages with' };

  const result = spawnPackageManager({ binary, args, spawn: { cwd: root, stdio: 'inherit', env: installEnv() } });

  if (result.error) return { ok: false, command, reason: result.error.message };

  if (result.status !== 0) return { ok: false, command, reason: `${command} exited with ${result.status}` };

  return { ok: true, command };
};

/** The command a developer runs by hand when this repo has no Nx to run the generator with. */
export const manualGeneratorCommand = (options: { manager: PackageManager; migration: Migration }) =>
  nxCommand({ manager: options.manager, args: generatorArgs({ migration: options.migration, dryRun: false }) }).join(
    ' ',
  );

const runOne = (options: {
  root: string;
  manager: PackageManager;
  entry: PendingMigration;
  dryRun: boolean;
  nxAvailable: boolean;
}): MigrationOutcome => {
  const { root, manager, entry, dryRun, nxAvailable } = options;

  if (entry.migration.kind !== 'auto') return { pending: entry, state: 'task' };

  if (!nxAvailable) {
    return {
      pending: entry,
      state: 'unsupported',
      reason: 'this repo has no Nx, so the generator has to be run by hand',
    };
  }

  const missing = missingRequirement({ root, migration: entry.migration });

  if (missing !== undefined && dryRun) return { pending: entry, state: 'planned' };

  if (missing !== undefined) {
    return { pending: entry, state: 'failed', reason: `the generator needs ${missing}: add it as a dev dependency` };
  }

  return runAutoMigration({ root, manager, pending: entry, dryRun });
};

export const runPendingMigrations = (options: {
  root: string;
  manager: PackageManager;
  pending: readonly PendingMigration[];
  dryRun: boolean;
  afterEach?: (outcome: MigrationOutcome) => void;
}): MigrationOutcome[] => {
  const { root, manager, pending, dryRun, afterEach } = options;
  const nxAvailable = hasNx(root);

  return pending.map((entry) => {
    const outcome = runOne({ root, manager, entry, dryRun, nxAvailable });

    afterEach?.(outcome);

    return outcome;
  });
};
