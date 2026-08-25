import { hasUncommittedChanges } from '../api/git';
import { readLocalConfig } from '../config/local-config';
import { AGENT_COMMAND_KEY, assistedTasks, runAgentTasks } from './ai';
import { parseUpdateArgs } from './args';
import { readPackageMigrations } from './migration-manifest';
import { PackageManager, detectPackageManager } from './package-manager';
import {
  DeclaredPackage,
  ROOT_MANIFEST,
  declaredEthletePackages,
  findManifests,
  manifestPath,
  readManifest,
  writeRanges,
} from './packages';
import {
  PackageUpdate,
  PendingMigration,
  UpdatedPackage,
  chooseTarget,
  isDowngrade,
  orderMigrations,
  pendingMigrations,
} from './plan';
import { PENDING_FILE, clearPendingUpdate, readPendingUpdate, writePendingUpdate } from './pending';
import { fetchRegistryPackage, registryUrl } from './registry';
import { MigrationOutcome, hasNx, runInstall, runPendingMigrations } from './run-migrations';
import { UPDATE_DIR, writeUpdateTasks } from './tasks';

export type UpdateCommandOptions = {
  /** Arguments after `update`, for example `['core', '--tag', 'next']`. */
  argv: string[];
  root?: string;
  /** How the caller is invoked, used in the usage line. */
  invocation?: string;
};

const usage = (invocation: string) =>
  [
    `Usage: ${invocation} [packages...] [flags]`,
    '',
    'Moves the @ethlete/* packages this repo declares to a newer version, then runs the migrations',
    'those versions ship: the codemods by itself, and a report for everything that needs a decision.',
    '',
    'Every package.json in the repo is rewritten, not only the root one, so a library manifest that',
    'pins @ethlete/* moves with it.',
    '',
    'A package may be named short (`core`) or in full (`@ethlete/core`). With no name, every',
    '@ethlete/* dependency is updated.',
    '',
    'Flags',
    '  --check         Print what would change and exit 1 when an update is pending. Writes nothing',
    '  --dry-run       Print the plan, and the migrations the installed versions know about',
    '  --tag <tag>     Dist tag to update to. Defaults to the tag the installed prerelease is on',
    '  --to <version>  Exact version for the one package you name',
    '  --from <p@ver>  The version a package migrates from, when the installed one is already newer',
    '  --no-install    Write package.json, then stop. Install yourself and re-run with --continue',
    '  --continue      Run the migrations of an update that was written but never finished',
    '  --ai            Hand every agent-assisted task to the command in updateAgentCommand',
    '  --force         Update even when the working tree has uncommitted changes',
  ].join('\n');

const padded = (value: string, width: number) => value.padEnd(width);

const printUpdates = (updates: readonly PackageUpdate[]) => {
  const width = Math.max(...updates.map((update) => update.name.length));

  for (const update of updates) {
    const tag = update.tag ? `  (${update.tag})` : '';

    console.log(`  ${padded(update.name, width)}  ${update.from ?? 'not installed'} → ${update.to}${tag}`);
  }
};

const problemsOf = (updates: readonly PackageUpdate[]) =>
  updates.flatMap((update) =>
    update.unwritable.map(
      (site) =>
        `${site.manifestPath} declares ${update.name} as "${site.range}", which no single version can be ` +
        `written into. Change it to ${update.to} by hand.`,
    ),
  );

type ResolveResult = {
  updates: PackageUpdate[];
  problems: string[];
  upToDate: string[];
};

const resolveUpdates = async (options: {
  declared: readonly DeclaredPackage[];
  version?: string;
  tag?: string;
}): Promise<ResolveResult> => {
  const { declared, version, tag } = options;
  const registry = registryUrl();
  const result: ResolveResult = { updates: [], problems: [], upToDate: [] };

  const lookups = await Promise.all(
    declared.map(async (entry) => ({
      entry,
      lookup: await fetchRegistryPackage({ packageName: entry.name, registry }),
    })),
  );

  for (const { entry, lookup } of lookups) {
    if (!lookup.ok) {
      result.problems.push(`${entry.name}: ${lookup.reason}`);
      continue;
    }

    const choice = chooseTarget({ declared: entry, registry: lookup.package, request: { version, tag } });

    if ('problem' in choice) {
      result.problems.push(choice.problem);
      continue;
    }

    if ('upToDate' in choice) {
      result.upToDate.push(entry.name);
      continue;
    }

    result.updates.push(choice.update);
  }

  return result;
};

type CollectedMigrations = {
  pending: PendingMigration[];
  notes: string[];
  problems: string[];
};

const collectMigrations = (options: {
  root: string;
  updates: readonly UpdatedPackage[];
  from: Record<string, string>;
}): CollectedMigrations => {
  const { root, updates, from } = options;
  const collected: CollectedMigrations = { pending: [], notes: [], problems: [] };

  for (const update of updates) {
    const start = from[update.name] ?? update.from;

    if (start === undefined) {
      collected.notes.push(`${update.name} was not installed before, so it has nothing to migrate.`);
      continue;
    }

    const packageMigrations = readPackageMigrations({ root, packageName: update.name });

    collected.problems.push(...packageMigrations.problems);
    collected.pending.push(...pendingMigrations({ packageMigrations, from: start, to: update.to }));
  }

  collected.pending = orderMigrations(collected.pending);

  return collected;
};

const printMigrations = (pending: readonly PendingMigration[]) => {
  for (const entry of pending) {
    console.log(
      `  ${entry.migration.version}  ${entry.packageName}  ${entry.migration.name} (${entry.migration.kind})`,
    );
  }
};

const printOutcomes = (outcomes: readonly MigrationOutcome[]) => {
  const applied = outcomes.filter((outcome) => outcome.state === 'applied').length;
  const failed = outcomes.filter((outcome) => outcome.state === 'failed');
  const tasks = outcomes.filter((outcome) => outcome.state === 'task' || outcome.state === 'unsupported').length;

  console.log(`\n  ${applied} codemod(s) applied, ${tasks} task(s) left, ${failed.length} failed`);

  for (const outcome of failed) {
    console.error(`  - ${outcome.pending.packageName} ${outcome.pending.migration.name}: ${outcome.reason}`);
  }
};

const runMigrationPhase = (options: {
  root: string;
  manager: PackageManager;
  updates: readonly UpdatedPackage[];
  from: Record<string, string>;
  dryRun: boolean;
  ai: boolean;
}) => {
  const { root, manager, updates, from, dryRun, ai } = options;
  const collected = collectMigrations({ root, updates, from });

  for (const note of collected.notes) console.log(`  ${note}`);

  for (const problem of collected.problems) console.error(`  ${problem}`);

  if (collected.pending.length === 0) {
    console.log('\nNo migration is pending for those versions.');

    return { failed: collected.problems.length > 0 };
  }

  console.log(`\n${collected.pending.length} migration(s) to run:\n`);
  printMigrations(collected.pending);

  if (!hasNx(root)) {
    console.log('\n  This repo has no Nx, so every codemod is reported as a command to run by hand.');
  }

  const outcomes = runPendingMigrations({ root, manager, pending: collected.pending, dryRun });

  printOutcomes(outcomes);

  if (dryRun) {
    console.log('\nDry run: no report was written.');

    return { failed: false };
  }

  const written = writeUpdateTasks({
    root,
    updates,
    outcomes,
    manager,
    generatedAt: new Date().toISOString(),
  });

  if (written.tasks.length > 0) {
    console.log(`\n  ${written.tasks.length} task(s) written to ${written.reportPath}`);
    console.log(`  The same list for an agent: ${written.dataPath}`);
  }

  if (ai) {
    const template = readLocalConfig(root).config.updateAgentCommand;
    const assisted = assistedTasks(written.tasks);

    if (assisted.length === 0) console.log('\n  --ai had nothing to do: no task is agent-assisted.');
    else if (!template) {
      console.error(`\n  --ai needs "${AGENT_COMMAND_KEY}" in ethlete.config.local.json, for example "claude -p".`);
    } else {
      const runs = runAgentTasks({ root, template, tasks: written.tasks });
      const failed = runs.filter((run) => !run.ok);

      for (const run of failed) console.error(`  ${run.task.name}: ${run.reason}`);
    }
  }

  return { failed: outcomes.some((outcome) => outcome.state === 'failed') || collected.problems.length > 0 };
};

const resume = (options: { root: string; manager: PackageManager; argv: ReturnType<typeof parseUpdateArgs> }) => {
  const { root, manager, argv } = options;
  const pending = readPendingUpdate(root);

  if (!pending) {
    console.error(`Nothing to continue: ${PENDING_FILE} is not there.`);

    return 1;
  }

  console.log(`\nContinuing the update started at ${pending.startedAt}:\n`);

  const updates: UpdatedPackage[] = pending.packages.map((entry) => ({
    name: entry.name,
    from: entry.from ?? undefined,
    to: entry.to,
  }));

  for (const update of updates) {
    console.log(`  ${update.name}  ${update.from ?? 'not installed'} → ${update.to}`);
  }

  const result = runMigrationPhase({
    root,
    manager,
    updates,
    from: argv.from,
    dryRun: argv.dryRun,
    ai: argv.ai,
  });

  if (!result.failed && !argv.dryRun) clearPendingUpdate(root);

  return result.failed ? 1 : 0;
};

/**
 * Moves this repo's `@ethlete/*` dependencies to a newer version and runs the migrations those versions
 * ship. Everything the codemods cannot decide is written to a task list under `.ethlete/update`.
 */
export const updateCommand = async ({
  argv,
  root = process.cwd(),
  invocation = 'et update',
}: UpdateCommandOptions): Promise<number> => {
  const args = parseUpdateArgs(argv);

  if (args.help) {
    console.log(usage(invocation));

    return 0;
  }

  if (args.problems.length > 0) {
    console.error(`${args.problems.join('\n')}\n\n${usage(invocation)}`);

    return 1;
  }

  const manifest = readManifest(root);

  if (!manifest) {
    console.error(`${manifestPath(root)} cannot be read, so there is nothing to update.`);

    return 1;
  }

  const manager = detectPackageManager({ root, manifest });

  if (args.resume) return resume({ root, manager, argv: args });

  const manifests = findManifests(root);
  const all = declaredEthletePackages({ root, manifests });
  const named = args.packages.filter((name) => !all.some((entry) => entry.name === name));

  if (named.length > 0) {
    console.error(`This repo declares no ${named.join(', ')}.`);

    return 1;
  }

  const declared = args.packages.length === 0 ? all : all.filter((entry) => args.packages.includes(entry.name));

  if (declared.length === 0) {
    console.log('This repo declares no @ethlete/* dependency.');

    return 0;
  }

  const resolved = await resolveUpdates({ declared, version: args.version, tag: args.tag });

  for (const problem of resolved.problems) console.error(`  ${problem}`);

  if (resolved.updates.length === 0) {
    console.log(`\nEvery @ethlete package is on its newest version (${resolved.upToDate.length} checked).`);

    return resolved.problems.length > 0 ? 1 : 0;
  }

  console.log('');

  if (manifests.length > 1) console.log(`  ${manifests.length} package.json files scanned.\n`);

  printUpdates(resolved.updates);

  for (const update of resolved.updates.filter(isDowngrade)) {
    console.log(`\n  ${update.name} moves back to ${update.to}, which is older than the installed ${update.from}.`);
  }

  const rangeProblems = problemsOf(resolved.updates);

  for (const problem of rangeProblems) console.error(`\n  ${problem}`);

  const writable = resolved.updates.filter((update) => update.writes.length > 0);

  if (args.check) {
    console.log(`\nRun \`${invocation}\` to apply this.`);

    return 1;
  }

  if (args.dryRun) {
    console.log('\nMigrations the installed versions know about. The target may ship more:\n');
    printMigrations(collectMigrations({ root, updates: writable, from: args.from }).pending);
    console.log('\nDry run: nothing was written.');

    return 0;
  }

  if (writable.length === 0) {
    console.error('\nNo range could be written. Nothing was changed.');

    return 1;
  }

  if (!args.force && hasUncommittedChanges(root)) {
    console.error(
      '\nThe working tree has uncommitted changes, and the codemods rewrite files.\n' +
        'Commit or stash them first, or re-run with --force.',
    );

    return 1;
  }

  const changedManifests = writeRanges({ root, writes: writable.flatMap((update) => update.writes) });

  writePendingUpdate({
    root,
    pending: {
      startedAt: new Date().toISOString(),
      packages: writable.map((update) => ({ name: update.name, from: update.from ?? null, to: update.to })),
    },
  });

  const manifestNote =
    changedManifests.length === 1
      ? (changedManifests[0] ?? ROOT_MANIFEST)
      : `${changedManifests.length} package.json files`;

  console.log(`\n  ${manifestNote} updated. The migration plan is in ${PENDING_FILE}.`);

  if (!args.install) {
    console.log(`\nInstall the new versions, then run \`${invocation} --continue\`.`);

    return 0;
  }

  console.log(`\n  ${manager.install.join(' ')}\n`);

  const installed = runInstall({ root, manager });

  if (!installed.ok) {
    console.error(
      `\nThe install failed: ${installed.reason}\n` +
        `Fix it, then run \`${invocation} --continue\` to run the migrations.`,
    );

    return 1;
  }

  const result = runMigrationPhase({
    root,
    manager,
    updates: writable,
    from: args.from,
    dryRun: false,
    ai: args.ai,
  });

  if (result.failed) {
    console.error(`\nRun \`${invocation} --continue\` again once the failures above are fixed.`);

    return 1;
  }

  clearPendingUpdate(root);

  console.log(`\nDone. Read ${UPDATE_DIR} for anything left to do.`);

  return rangeProblems.length > 0 ? 1 : 0;
};
