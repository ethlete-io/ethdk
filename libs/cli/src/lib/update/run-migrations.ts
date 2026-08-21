import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { Migration } from './migration-manifest';
import { PackageManager, nxCommand } from './package-manager';
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

  const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit' });

  if (result.error) return { pending, state: 'failed', reason: result.error.message };

  if (result.status !== 0) return { pending, state: 'failed', reason: `${binary} exited with ${result.status}` };

  return { pending, state: dryRun ? 'planned' : 'applied' };
};

export const runInstall = (options: { root: string; manager: PackageManager }) => {
  const { root, manager } = options;
  const [binary, ...args] = manager.install;

  if (binary === undefined) return { ok: false, reason: 'no install command' };

  const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit' });

  if (result.error) return { ok: false, reason: result.error.message };

  if (result.status !== 0) return { ok: false, reason: `${manager.install.join(' ')} exited with ${result.status}` };

  return { ok: true };
};

/** The command a developer runs by hand when this repo has no Nx to run the generator with. */
export const manualGeneratorCommand = (options: { manager: PackageManager; migration: Migration }) =>
  nxCommand({ manager: options.manager, args: generatorArgs({ migration: options.migration, dryRun: false }) }).join(
    ' ',
  );

export const runPendingMigrations = (options: {
  root: string;
  manager: PackageManager;
  pending: readonly PendingMigration[];
  dryRun: boolean;
}): MigrationOutcome[] => {
  const { root, manager, pending, dryRun } = options;
  const nxAvailable = hasNx(root);

  return pending.map((entry) => {
    if (entry.migration.kind !== 'auto') return { pending: entry, state: 'task' };

    if (!nxAvailable) {
      return {
        pending: entry,
        state: 'unsupported',
        reason: 'this repo has no Nx, so the generator has to be run by hand',
      };
    }

    return runAutoMigration({ root, manager, pending: entry, dryRun });
  });
};
