import { hasUncommittedChanges } from '../api/git';
import { fullPackageName } from './args';
import { AvailableMigration, collectAvailableMigrations } from './available-migrations';
import { createStepCommitter, startCommits } from './commits';
import { readPackageMigrations } from './migration-manifest';
import { MIGRATION_RECORD_FILE, migrationKey, readMigrationRecord, writeMigrationRun } from './migration-record';
import { detectPackageManager } from './package-manager';
import { installedVersion, manifestPath, readManifest } from './packages';
import { PENDING_FILE, readPendingUpdate } from './pending';
import { runPendingMigrations } from './run-migrations';
import { compareVersions } from './semver';
import { docsBaseUrl, writeUpdateTasks } from './tasks';
import { NOT_A_CHECKOUT, commitMigration, ignoreTaskList, printOutcomes } from './update-command';

export type MigrationsCommandOptions = {
  /** Arguments after `migrations`, for example `['run', 'query:to-query-v3']`. */
  argv: string[];
  root?: string;
  /** How the caller is invoked, used in the usage line. */
  invocation?: string;
  /** How `et update` is invoked in this repo, for the hint on a required migration. */
  updateInvocation?: string;
};

const usage = (invocation: string) =>
  [
    `Usage: ${invocation}`,
    `       ${invocation} run <package>:<name> [flags]`,
    '',
    'Lists the recommended and optional migrations the installed @ethlete/* versions ship and this repo',
    `has not run yet, or runs one of them. Each run is recorded in ${MIGRATION_RECORD_FILE}; commit it.`,
    '',
    'Flags',
    '  --no-commit  Leave the change uncommitted. By default the run is committed by itself',
    '  --force      Run even when the working tree has uncommitted changes',
  ].join('\n');

type MigrationsArgs = {
  run?: string;
  commit: boolean;
  force: boolean;
  help: boolean;
  problems: string[];
};

const parseArgs = (argv: readonly string[]): MigrationsArgs => {
  const args: MigrationsArgs = { commit: true, force: false, help: false, problems: [] };
  const [first, ...rest] = argv;
  const positional: string[] = [];

  for (const argument of first === 'run' ? rest : argv) {
    if (argument === '--no-commit') args.commit = false;
    else if (argument === '--force') args.force = true;
    else if (argument === '--help' || argument === '-h') args.help = true;
    else if (argument.startsWith('-')) args.problems.push(`Unknown flag "${argument}".`);
    else positional.push(argument);
  }

  if (first !== 'run') {
    if (positional.length > 0) args.problems.push(`Unknown command "${positional.join(' ')}".`);

    return args;
  }

  if (positional.length !== 1) args.problems.push('run needs one migration, as <package>:<name>.');
  else args.run = positional[0];

  return args;
};

const printAvailable = (options: { available: readonly AvailableMigration[]; invocation: string }) => {
  const { available, invocation } = options;

  console.log(`${available.length} migration${available.length === 1 ? ' is' : 's are'} available:\n`);

  for (const entry of available) {
    const { migration, packageName, installed } = entry;

    console.log(`  ${migration.level}  ${migrationKey({ packageName, name: migration.name })} (${migration.kind})`);
    console.log(`    ${migration.description}`);

    if (migration.docs) console.log(`    Docs: ${docsBaseUrl(installed)}${migration.docs}`);

    console.log(`    Run: ${invocation} run ${migrationKey({ packageName, name: migration.name })}\n`);
  }
};

const list = (options: { root: string; invocation: string }) => {
  const { root, invocation } = options;
  const { available, problems } = collectAvailableMigrations(root);

  for (const problem of problems) console.error(`  ${problem}`);

  if (available.length === 0) console.log('No recommended or optional migration is available.');
  else printAvailable({ available, invocation });

  return problems.length > 0 ? 1 : 0;
};

type Lookup = { entry: AvailableMigration } | { problem: string };

const findAvailable = (options: {
  root: string;
  key: string;
  invocation: string;
  updateInvocation: string;
}): Lookup => {
  const { root, key, invocation, updateInvocation } = options;
  const separator = key.indexOf(':');

  if (separator <= 0 || separator === key.length - 1) {
    return { problem: `"${key}" names no migration. Name one as <package>:<name>.` };
  }

  const packageName = fullPackageName(key.slice(0, separator));
  const name = key.slice(separator + 1);
  const fullKey = migrationKey({ packageName, name });
  const installed = installedVersion(root, packageName);

  if (installed === undefined) return { problem: `${packageName} is not installed.` };

  const packageMigrations = readPackageMigrations({ root, packageName });
  const migration = packageMigrations.migrations.find((candidate) => candidate.name === name);

  if (!migration) {
    return {
      problem: `${packageName} ${installed} ships no migration "${name}". Run \`${invocation}\` to list the available ones.`,
    };
  }

  if (migration.level === 'required') {
    return { problem: `${fullKey} is required, so \`${updateInvocation}\` runs it. It cannot run on its own.` };
  }

  const run = readMigrationRecord(root).record[fullKey];

  if (run) return { problem: `${fullKey} already ran on ${run.ranAt}, with ${packageName} ${run.version}.` };

  if (compareVersions(migration.version, installed) > 0) {
    return {
      problem: `${fullKey} lands in ${migration.version}, and ${packageName} is on ${installed}. Run \`${updateInvocation}\` first.`,
    };
  }

  return { entry: { packageName, migration, manifestPath: packageMigrations.manifestPath, installed } };
};

const runOne = (options: {
  root: string;
  args: MigrationsArgs & { run: string };
  invocation: string;
  updateInvocation: string;
}) => {
  const { root, args, invocation, updateInvocation } = options;
  const manifest = readManifest(root);

  if (!manifest) {
    console.error(`${manifestPath(root)} cannot be read.`);

    return 1;
  }

  const lookup = findAvailable({ root, key: args.run, invocation, updateInvocation });

  if ('problem' in lookup) {
    console.error(lookup.problem);

    return 1;
  }

  const unfinished = readPendingUpdate(root);

  if (unfinished) {
    console.error(
      `The update started at ${unfinished.startedAt} is not finished (${PENDING_FILE}).\n` +
        `Run \`${updateInvocation} --continue\` to finish it first.`,
    );

    return 1;
  }

  if (!args.force && hasUncommittedChanges(root)) {
    console.error(
      'The working tree has uncommitted changes, and the migration rewrites files.\n' +
        'Commit or stash them first, or re-run with --force.',
    );

    return 1;
  }

  const { entry } = lookup;
  const manager = detectPackageManager({ root, manifest });
  const commits = args.commit ? startCommits(root) : undefined;

  if (args.commit && !commits) console.log(NOT_A_CHECKOUT);

  const committer = commits && createStepCommitter({ root, state: commits, save: () => undefined });

  ignoreTaskList(root);

  console.log(`\nRunning ${migrationKey({ packageName: entry.packageName, name: entry.migration.name })}:\n`);

  const outcomes = runPendingMigrations({
    root,
    manager,
    pending: [entry],
    dryRun: false,
    afterEach: (outcome) => {
      if (outcome.state !== 'failed') {
        writeMigrationRun({
          root,
          packageName: entry.packageName,
          name: entry.migration.name,
          run: { version: entry.installed, ranAt: new Date().toISOString() },
        });
      }

      if (outcome.state === 'task' || outcome.state === 'unsupported') {
        committer?.commit({
          message: `chore(deps): Record the ${entry.packageName} ${entry.migration.name} migration`,
        });
      } else commitMigration(committer, outcome);
    },
  });

  printOutcomes(outcomes, undefined);

  const written = writeUpdateTasks({ root, updates: [], outcomes, manager, generatedAt: new Date().toISOString() });

  if (written.tasks.length > 0) {
    console.log(`\n  ${written.tasks.length} task(s) written to ${written.reportPath}`);
    console.log(`  The same list for an agent: ${written.dataPath}`);
  }

  if (entry.migration.kind === 'assisted') {
    console.log(`\n  Run \`${updateInvocation} --continue --ai\` to hand the task to an agent.`);
  }

  return outcomes.some((outcome) => outcome.state === 'failed') ? 1 : 0;
};

/**
 * Lists the recommended and optional migrations this repo has not run, or runs one of them with the commit
 * and task-report flow of `et update`, and records the run in `.ethlete/migrations.json`.
 */
export const migrationsCommand = ({
  argv,
  root = process.cwd(),
  invocation = 'et migrations',
  updateInvocation = 'et update',
}: MigrationsCommandOptions) => {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(usage(invocation));

    return 0;
  }

  if (args.problems.length > 0) {
    console.error(`${args.problems.join('\n')}\n\n${usage(invocation)}`);

    return 1;
  }

  if (args.run === undefined) return list({ root, invocation });

  return runOne({ root, args: { ...args, run: args.run }, invocation, updateInvocation });
};
