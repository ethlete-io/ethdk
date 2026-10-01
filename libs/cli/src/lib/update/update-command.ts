import { hasUncommittedChanges } from '../api/git';
import { readLocalConfig } from '../config/local-config';
import { AgentRun, AgentRunState, assistedTasks, runAgentTasks } from './ai';
import { setUpAgentCommand } from './agent-setup';
import { AGENT_RULES_PACKAGE, planAgentRulesSync, runAgentRulesSync } from './agent-rules-sync';
import { parseUpdateArgs } from './args';
import { CommitState, StepCommitter, createStepCommitter, startCommits } from './commits';
import { UPDATE_IGNORE_ENTRY, ignoreUpdateDir } from './gitignore';
import { collectAvailableMigrations } from './available-migrations';
import { readPackageMigrations } from './migration-manifest';
import { PackageManager, detectPackageManager, spawnPackageManager } from './package-manager';
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
  availableMigrationsLine,
  pendingMigrations,
} from './plan';
import {
  PENDING_FILE,
  PendingUpdate,
  clearPendingUpdate,
  isFinished,
  readPendingUpdate,
  writePendingUpdate,
} from './pending';
import { fetchRegistryPackage, registryAuthorization, registryUrl } from './registry';
import { MigrationOutcome, hasNx, runInstall, runPendingMigrations } from './run-migrations';
import { SyncFailure, UPDATE_DIR, UpdateTask, refreshUpdateTasks, writeUpdateTasks } from './tasks';

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
    '  --ai            Hand every open agent-assisted task to the command in updateAgentCommand',
    '  --no-commit     Leave every change uncommitted. By default each step is committed by itself',
    '  --force         Update even when the working tree has uncommitted changes',
  ].join('\n');

const padded = (value: string, width: number) => value.padEnd(width);

const printUpdates = (updates: readonly (UpdatedPackage & { tag?: string })[]) => {
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
  root: string;
  manager: PackageManager;
  declared: readonly DeclaredPackage[];
  version?: string;
  tag?: string;
}): Promise<ResolveResult> => {
  const { root, manager, declared, version, tag } = options;
  const registry = registryUrl({ root, manager: manager.name });
  const authorization = registryAuthorization({ root, registry });
  const result: ResolveResult = { updates: [], problems: [], upToDate: [] };

  const lookups = await Promise.all(
    declared.map(async (entry) => ({
      entry,
      lookup: await fetchRegistryPackage({ packageName: entry.name, registry, authorization }),
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
  if (pending.length === 0) console.log('  none');

  for (const entry of pending) {
    console.log(
      `  ${entry.migration.version}  ${entry.packageName}  ${entry.migration.name} (${entry.migration.kind})`,
    );
  }
};

export const printOutcomes = (outcomes: readonly MigrationOutcome[], syncFailure: SyncFailure | undefined) => {
  const applied = outcomes.filter((outcome) => outcome.state === 'applied').length;
  const failed = outcomes.filter((outcome) => outcome.state === 'failed');
  const tasks = outcomes.filter((outcome) => outcome.state === 'task' || outcome.state === 'unsupported').length;
  const failedCount = failed.length + (syncFailure ? 1 : 0);

  console.log(`\n  ${applied} codemod(s) applied, ${tasks} task(s) left, ${failedCount} failed`);

  for (const outcome of failed) {
    console.error(`  - ${outcome.pending.packageName} ${outcome.pending.migration.name}: ${outcome.reason}`);
  }

  if (syncFailure) console.error(`  - ${syncFailure.command}: ${syncFailure.reason}`);
};

const SYNC_MESSAGE = 'chore(deps): Sync the ethlete agent rules';

const migrationMessage = (options: { packageName: string; name: string }) =>
  `chore(deps): Apply the ${options.packageName} ${options.name} migration`;

export const NOT_A_CHECKOUT = '\n  This is not a git checkout, so nothing is committed.';

const committerFor = (root: string, state: CommitState | undefined) =>
  state &&
  createStepCommitter({
    root,
    state,
    save: (commits) => {
      const saved = readPendingUpdate(root);

      if (saved) writePendingUpdate({ root, pending: { ...saved, commits } });
    },
  });

const commitBump = (options: { committer: StepCommitter | undefined; updates: readonly UpdatedPackage[] }) => {
  const { committer, updates } = options;

  if (!committer || committer.state.bumped) return;

  committer.commit({
    message: 'chore(deps): Update the ethlete SDK',
    body: updates.map((update) => `${update.name} ${update.from ?? 'not installed'} → ${update.to}`).join('\n'),
  });
  committer.markBumped();
};

export const commitMigration = (committer: StepCommitter | undefined, outcome: MigrationOutcome) => {
  if (outcome.state === 'applied')
    committer?.commit({
      message: migrationMessage({ packageName: outcome.pending.packageName, name: outcome.pending.migration.name }),
    });
  else if (outcome.state === 'failed') committer?.skip();
};

type SyncResult = { synced: boolean; failure?: SyncFailure };

const syncAgentRules = (options: {
  root: string;
  manager: PackageManager;
  updates: readonly UpdatedPackage[];
  dryRun: boolean;
}): SyncResult => {
  const { root, manager, updates, dryRun } = options;
  const plan = planAgentRulesSync({ root, manager, updates });

  if (plan.state === 'not-updated') return { synced: false };

  const command = plan.command.join(' ');

  if (plan.state === 'no-config') {
    console.log(
      `\n  ${AGENT_RULES_PACKAGE} moved, but this repo has no config for it. Run \`${command}\` where it has one.`,
    );

    return { synced: false };
  }

  if (dryRun) {
    console.log(`\n  ${AGENT_RULES_PACKAGE} moved: a real run regenerates the agent rules with \`${command}\`.`);

    return { synced: false };
  }

  console.log(`\n  ${AGENT_RULES_PACKAGE} moved, so the agent rules and skills are regenerated.\n\n  ${command}\n`);

  const outcome = runAgentRulesSync(plan, root);

  if (outcome.state !== 'failed') return { synced: true };

  console.error(`  The agent rules sync failed: ${outcome.reason}`);

  return { synced: false, failure: { command, reason: outcome.reason } };
};

/** Hands the open assisted tasks to the agent and reports the runs. False when one of them failed. */
const handToAgent = async (options: {
  root: string;
  template: string;
  tasks: readonly UpdateTask[];
  committer: StepCommitter | undefined;
}) => {
  const { root, template, tasks, committer } = options;

  if (assistedTasks(tasks).length === 0) {
    console.log('\n  --ai had nothing to do: no open task is agent-assisted.');

    return true;
  }

  const runs = await runAgentTasks({
    root,
    template,
    tasks,
    ...(committer && {
      afterRun: (run: AgentRun) => {
        if (run.state === 'done') committer.commit({ message: migrationMessage(run.task) });
        else committer.skip();
      },
    }),
  });
  const count = (state: AgentRunState) => runs.filter((run) => run.state === state).length;

  console.log(`\n  ${count('done')} agent task(s) done, ${count('open')} still open, ${count('failed')} failed`);

  return count('failed') === 0;
};

const agentFailedHint = (invocation: string) =>
  `\nAn agent run failed. Run \`${invocation} --ai\` again to hand it the tasks that are still open.`;

const CLI_PACKAGE = '@ethlete/cli';

/**
 * Runs the migration phase in the `et` the install just put in place. The running process is the old one, and
 * it lacks every step a newer CLI added to the phase.
 */
const continueWithInstalledCli = (options: { root: string; manager: PackageManager; ai: boolean; commit: boolean }) => {
  const { root, manager, ai, commit } = options;
  const [binary, ...args] = [
    ...manager.run,
    'et',
    'update',
    '--continue',
    ...(ai ? ['--ai'] : []),
    ...(commit ? [] : ['--no-commit']),
  ];

  if (binary === undefined) return 1;

  console.log(
    `\n  ${CLI_PACKAGE} moved, so the new version runs the migrations.\n\n  ${[binary, ...args].join(' ')}\n`,
  );

  const result = spawnPackageManager({ binary, args, spawn: { cwd: root, stdio: 'inherit' } });

  return result.error ? 1 : (result.status ?? 1);
};

const runMigrationPhase = async (options: {
  root: string;
  manager: PackageManager;
  pendingUpdate: PendingUpdate;
  updates: readonly UpdatedPackage[];
  from: Record<string, string>;
  dryRun: boolean;
  agent: string | undefined;
  committer: StepCommitter | undefined;
}) => {
  const { root, manager, pendingUpdate, updates, from, dryRun, agent, committer } = options;
  const finished = pendingUpdate.finished ?? [];
  const collected = collectMigrations({ root, updates, from });
  const skipped = collected.pending.filter((entry) =>
    isFinished({ finished, packageName: entry.packageName, name: entry.migration.name }),
  );

  collected.pending = collected.pending.filter((entry) => !skipped.includes(entry));

  if (skipped.length > 0) console.log(`\n  ${skipped.length} codemod(s) already applied in the earlier run.`);

  for (const note of collected.notes) console.log(`  ${note}`);

  for (const problem of collected.problems) console.error(`  ${problem}`);

  // Before the tasks and any --ai run: the tasks assume the skills of the version that was installed.
  const sync = syncAgentRules({ root, manager, updates, dryRun });
  const syncFailure = sync.failure;

  if (sync.synced) committer?.commit({ message: SYNC_MESSAGE });
  else if (syncFailure) committer?.skip();

  const nothingPending = collected.pending.length === 0;

  if (nothingPending) console.log('\nNo migration is pending for those versions.');
  else {
    console.log(`\n${collected.pending.length} migration(s) to run:\n`);
    printMigrations(collected.pending);

    if (!hasNx(root)) {
      console.log('\n  This repo has no Nx, so every codemod is reported as a command to run by hand.');
    }
  }

  const outcomes = runPendingMigrations({
    root,
    manager,
    pending: collected.pending,
    dryRun,
    afterEach: (outcome) => commitMigration(committer, outcome),
  });

  if (!nothingPending) printOutcomes(outcomes, syncFailure);

  const availableLine = availableMigrationsLine(collectAvailableMigrations(root).available);

  if (availableLine) console.log(`\n  ${availableLine}`);

  if (!dryRun) {
    const applied = outcomes
      .filter((outcome) => outcome.state === 'applied')
      .map((outcome) => ({ packageName: outcome.pending.packageName, name: outcome.pending.migration.name }));

    writePendingUpdate({
      root,
      pending: {
        ...pendingUpdate,
        ...(committer && { commits: committer.state }),
        finished: [...finished, ...applied],
      },
    });
  }

  if (dryRun) {
    if (!nothingPending) console.log('\nDry run: no report was written.');

    return {
      failed: nothingPending && (collected.problems.length > 0 || syncFailure !== undefined),
      agentFailed: false,
    };
  }

  const written = writeUpdateTasks({
    root,
    updates,
    outcomes: [...skipped.map((entry): MigrationOutcome => ({ pending: entry, state: 'applied' })), ...outcomes],
    manager,
    generatedAt: new Date().toISOString(),
    syncFailure,
  });

  if (written.tasks.length > 0) {
    console.log(`\n  ${written.tasks.length} task(s) written to ${written.reportPath}`);
    console.log(`  The same list for an agent: ${written.dataPath}`);
  }

  const agentOk =
    agent === undefined || (await handToAgent({ root, template: agent, tasks: written.tasks, committer }));

  return {
    agentFailed: !agentOk,
    failed:
      outcomes.some((outcome) => outcome.state === 'failed') ||
      collected.problems.length > 0 ||
      syncFailure !== undefined,
  };
};

export const ignoreTaskList = (root: string) => {
  if (!ignoreUpdateDir(root)) return;

  console.log(`\n  ${UPDATE_IGNORE_ENTRY} added to .gitignore: the task list is yours, not the repo's.`);
};

const continueHint = (invocation: string) =>
  `\nRun \`${invocation} --continue\` again once the failures above are fixed.`;

/** Hands the tasks an earlier run left to the agent, for an `--ai` run that has no update to make. */
const workOpenTasks = async (options: { root: string; agent: string; invocation: string; commit: boolean }) => {
  const { root, agent, invocation, commit } = options;
  const tasks = refreshUpdateTasks(root);

  if (tasks === undefined) {
    console.log(`\n  --ai had nothing to do: ${UPDATE_DIR} holds no task list.`);

    return 0;
  }

  const commits = commit ? startCommits(root) : undefined;

  if (commit && !commits) console.log(NOT_A_CHECKOUT);

  if (await handToAgent({ root, template: agent, tasks, committer: committerFor(root, commits) })) return 0;

  console.error(agentFailedHint(invocation));

  return 1;
};

const exitAfterAgent = (options: { agentFailed: boolean; invocation: string }) => {
  if (!options.agentFailed) return 0;

  console.error(agentFailedHint(options.invocation));

  return 1;
};

const resume = async (options: {
  root: string;
  manager: PackageManager;
  argv: ReturnType<typeof parseUpdateArgs>;
  invocation: string;
  agent: string | undefined;
}) => {
  const { root, manager, argv, invocation, agent } = options;
  const pending = readPendingUpdate(root);

  if (!pending && agent !== undefined && !argv.dryRun) {
    console.log(`No update to continue: handing the open tasks in ${UPDATE_DIR} to the agent.`);

    return workOpenTasks({ root, agent, invocation, commit: argv.commit });
  }

  if (!pending) {
    console.error(`Nothing to continue: ${PENDING_FILE} is not there.`);

    return 1;
  }

  if (!argv.dryRun) ignoreTaskList(root);

  console.log(`\nContinuing the update started at ${pending.startedAt}:\n`);

  const updates: UpdatedPackage[] = pending.packages.map((entry) => ({
    name: entry.name,
    from: entry.from ?? undefined,
    to: entry.to,
  }));

  printUpdates(updates);

  const committer = argv.commit && !argv.dryRun ? committerFor(root, pending.commits) : undefined;

  commitBump({ committer, updates });

  const result = await runMigrationPhase({
    root,
    manager,
    pendingUpdate: pending,
    updates,
    from: { ...pending.from, ...argv.from },
    dryRun: argv.dryRun,
    agent,
    committer,
  });

  if (argv.dryRun) return result.failed ? 1 : 0;

  if (result.failed) {
    console.error(continueHint(invocation));

    return 1;
  }

  clearPendingUpdate(root);

  return exitAfterAgent({ agentFailed: result.agentFailed, invocation });
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

  const agent = args.ai
    ? (readLocalConfig(root).config.updateAgentCommand ?? (await setUpAgentCommand({ root })))
    : undefined;

  if (args.ai && !agent) return 1;

  const manifest = readManifest(root);

  if (!manifest) {
    console.error(`${manifestPath(root)} cannot be read, so there is nothing to update.`);

    return 1;
  }

  const manager = detectPackageManager({ root, manifest });

  const unfinished = args.resume ? undefined : readPendingUpdate(root);

  if (unfinished) {
    console.error(
      `\nThe update started at ${unfinished.startedAt} is not finished (${PENDING_FILE}).\n` +
        `Run \`${invocation} --continue\` to finish it.`,
    );

    return 1;
  }

  if (args.resume) return resume({ root, manager, argv: args, invocation, agent });

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

  const resolved = await resolveUpdates({ root, manager, declared, version: args.version, tag: args.tag });

  for (const problem of resolved.problems) console.error(`  ${problem}`);

  if (resolved.updates.length === 0) {
    if (resolved.problems.length > 0) {
      console.error(
        `\n${resolved.problems.length} lookup(s) failed, ${resolved.upToDate.length} package(s) on their newest version.`,
      );

      return 1;
    }

    console.log(`\nEvery @ethlete package is on its newest version (${resolved.upToDate.length} checked).`);

    if (args.check || args.dryRun) return 0;

    if (agent !== undefined) return workOpenTasks({ root, agent, invocation, commit: args.commit });

    refreshUpdateTasks(root);

    return 0;
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

  const commits = args.commit ? startCommits(root) : undefined;

  if (args.commit && !commits) console.log(NOT_A_CHECKOUT);

  ignoreTaskList(root);

  const changedManifests = writeRanges({ root, writes: writable.flatMap((update) => update.writes) });

  const pendingUpdate: PendingUpdate = {
    startedAt: new Date().toISOString(),
    packages: writable.map((update) => ({ name: update.name, from: update.from ?? null, to: update.to })),
    ...(Object.keys(args.from).length > 0 ? { from: args.from } : {}),
    ...(commits && { commits }),
  };

  writePendingUpdate({ root, pending: pendingUpdate });

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

  const committer = committerFor(root, commits);

  commitBump({ committer, updates: writable });

  if (writable.some((update) => update.name === CLI_PACKAGE && update.from !== update.to)) {
    return continueWithInstalledCli({ root, manager, ai: args.ai, commit: args.commit });
  }

  const result = await runMigrationPhase({
    root,
    manager,
    pendingUpdate,
    updates: writable,
    from: args.from,
    dryRun: false,
    agent,
    committer,
  });

  if (result.failed) {
    console.error(continueHint(invocation));

    return 1;
  }

  clearPendingUpdate(root);

  console.log(`\nDone. Read ${UPDATE_DIR} for anything left to do.`);

  if (result.agentFailed) return exitAfterAgent({ agentFailed: true, invocation });

  return rangeProblems.length > 0 ? 1 : 0;
};
