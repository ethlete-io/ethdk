import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const loadUpdate = (sdkRoot) => {
  const base = join(sdkRoot, 'dist/libs/cli/src/lib/update');
  return {
    plan: require(join(base, 'plan.js')),
    manifest: require(join(base, 'migration-manifest.js')),
    run: require(join(base, 'run-migrations.js')),
  };
};

export const installedVersions = (scopeDir, libs) =>
  Object.fromEntries(
    libs.flatMap((lib) => {
      try {
        const { version } = JSON.parse(readFileSync(join(scopeDir, lib, 'package.json'), 'utf8'));
        return [[`@ethlete/${lib}`, version]];
      } catch {
        return [];
      }
    }),
  );

/** The required migrations `et update` runs when moving each package from `from` to `to`. */
export const pendingSmokeMigrations = ({ sdkRoot, root, from, to }) => {
  const { plan, manifest } = loadUpdate(sdkRoot);
  const pending = [];
  for (const [packageName, start] of Object.entries(from)) {
    const target = to[packageName];
    if (target === undefined || start === target) continue;
    const packageMigrations = manifest.readPackageMigrations({ root, packageName });
    pending.push(...plan.pendingMigrations({ packageMigrations, from: start, to: target }));
  }
  return plan.orderMigrations(pending);
};

/** Copies the consumer's tracked and unignored files into a scratch dir and links its node_modules in. */
export const copyConsumer = (appRoot) => {
  const dest = mkdtempSync(join(tmpdir(), 'release-smoke-src-'));
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: appRoot,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (listed.status !== 0) throw new Error(`git ls-files failed in ${appRoot}`);
  for (const file of listed.stdout.toString().split('\0').filter(Boolean)) {
    const source = join(appRoot, file);
    if (!existsSync(source)) continue;
    mkdirSync(dirname(join(dest, file)), { recursive: true });
    cpSync(source, join(dest, file), { recursive: true, verbatimSymlinks: true });
  }
  symlinkSync(join(appRoot, 'node_modules'), join(dest, 'node_modules'), 'dir');
  return dest;
};

/** Runs the pending `et update` migrations in `root`, returning one line per outcome. */
export const runSmokeMigrations = ({ sdkRoot, root, pending }) => {
  const { run } = loadUpdate(sdkRoot);
  const manager = { name: 'npm', install: ['npm', 'install'], run: ['npx'] };
  const outcomes = run.runPendingMigrations({ root, manager, pending, dryRun: false });
  return outcomes.map(
    (outcome) =>
      `${outcome.pending.packageName}:${outcome.pending.migration.name} ${outcome.state}${outcome.reason ? ` (${outcome.reason})` : ''}`,
  );
};
