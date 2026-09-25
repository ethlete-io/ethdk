import { hasUncommittedChanges } from '../api/git';
import { readLocalConfig } from '../config/local-config';
import { AGENT_COMMAND_EXAMPLE, AGENT_COMMAND_KEY, AgentRunState, assistedTasks, runAgentTasks } from './ai';
import { AGENT_RULES_PACKAGE, planAgentRulesSync, runAgentRulesSync } from './agent-rules-sync';
import { parseUpdateArgs } from './args';
import { UPDATE_IGNORE_ENTRY, ignoreUpdateDir } from './gitignore';
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
import {
  PENDING_FILE,
  PendingUpdate,
  clearPendingUpdate,
  isFinished,
  readPendingUpdate,
  writePendingUpdate,
} from './pending';
import { fetchRegistryPackage, registryUrl } from './registry';
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
  if (pending.length === 0) console.log('  none');

  for (const entry of pending) {
    console.log(
      `  ${entry.migration.version}  ${entry.packageName}  ${entry.migration.name} (${entry.migration.kind})`,
    );
  }
};

const printOutcomes = (outcomes: readonly MigrationOutcome[], syncFailure: SyncFailure | undefined) => {
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

const syncAgentRules = (options: {
  root: string;
  manager: PackageManager;
  updates: readonly UpdatedPackage[];
  dryRun: boolean;
}): SyncFailure | undefined => {
  const { root, manager, updates, dryRun } = options;
  const plan = planAgentRulesSync({ root, manager, updates });

  if (plan.state === 'not-updated') return undefined;

  const command = plan.command.join(' ');

  if (plan.state === 'no-config') {
    console.log(
      `\n  ${AGENT_RULES_PACKAGE} moved, but this repo has no config for it. Run \`${command}\` where it has one.`,
    );

    return undefined;
  }

  if (dryRun) {
    console.log(`\n  ${AGENT_RULES_PACKAGE} moved: a real run regenerates the agent rules with \`${command}\`.`);

    return undefined;
  }

  console.log(`\n  ${AGENT_RULES_PACKAGE} moved, so the agent rules and skills are regenerated.\n\n  ${command}\n`);

  const outcome = runAgentRulesSync(plan, root);

  if (outcome.state !== 'failed') return undefined;

  console.error(`  The agent rules sync failed: ${outcome.reason}`);

  return { command, reason: outcome.reason };
};

/** Hands the open assisted tasks to the agent and reports the runs. False when one of them failed. */
const handToAgent = (options: { root: string; template: string; tasks: readonly UpdateTask[] }) => {
  const { root, template, tasks } = options;

  if (assistedTasks(tasks).length === 0) {
    console.log('\n  --ai had nothing to do: no open task is agent-assisted.');

    return true;
  }

  const runs = runAgentTasks({ root, template, tasks });
  const count = (state: AgentRunState) => runs.filter((run) => run.state === state).length;

  console.log(`\n  ${count('done')} agent task(s) done, ${count('open')} still open, ${count('failed')} failed`);

  return count('failed') === 0;
};

const agentFailedHint = (invocation: string) =>
  `\nAn agent run failed. Run \`${invocation} --ai\` again to hand it the tasks that are still open.`;

const runMigrationPhase = (options: {
  root: string;
  manager: PackageManager;
  pendingUpdate: PendingUpdate;
  updates: readonly UpdatedPackage[];
  from: Record<string, string>;
  dryRun: boolean;
  agent: string | undefined;
}) => {
  const { root, manager, pendingUpdate, updates, from, dryRun, agent } = options;
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
  const syncFailure = syncAgentRules({ root, manager, updates, dryRun });

  const nothingPending = collected.pending.length === 0;

  if (nothingPending) console.log('\nNo migration is pending for those versions.');
  else {
    console.log(`\n${collected.pending.length} migration(s) to run:\n`);
    printMigrations(collected.pending);

    if (!hasNx(root)) {
      console.log('\n  This repo has no Nx, so every codemod is reported as a command to run by hand.');
    }
  }

  const outcomes = runPendingMigrations({ root, manager, pending: collected.pending, dryRun });

  if (!nothingPending) printOutcomes(outcomes, syncFailure);

  if (!dryRun) {
    const applied = outcomes
      .filter((outcome) => outcome.state === 'applied')
      .map((outcome) => ({ packageName: outcome.pending.packageName, name: outcome.pending.migration.name }));

    writePendingUpdate({ root, pending: { ...pendingUpdate, finished: [...finished, ...applied] } });
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

  const agentOk = agent === undefined || handToAgent({ root, template: agent, tasks: written.tasks });

  return {
    agentFailed: !agentOk,
    failed:
      outcomes.some((outcome) => outcome.state === 'failed') ||
      collected.problems.length > 0 ||
      syncFailure !== undefined,
  };
};

const ignoreTaskList = (root: string) => {
  if (!ignoreUpdateDir(root)) return;

  console.log(`\n  ${UPDATE_IGNORE_ENTRY} added to .gitignore: the task list is yours, not the repo's.`);
};

const continueHint = (invocation: string) =>
  `\nRun \`${invocation} --continue\` again once the failures above are fixed.`;

/** Hands the tasks an earlier run left to the agent, for an `--ai` run that has no update to make. */
const workOpenTasks = (options: { root: string; agent: string; invocation: string }) => {
  const { root, agent, invocation } = options;
  const tasks = refreshUpdateTasks(root);

  if (tasks === undefined) {
    console.log(`\n  --ai had nothing to do: ${UPDATE_DIR} holds no task list.`);

    return 0;
  }

  if (handToAgent({ root, template: agent, tasks })) return 0;

  console.error(agentFailedHint(invocation));

  return 1;
};

const exitAfterAgent = (options: { agentFailed: boolean; invocation: string }) => {
  if (!options.agentFailed) return 0;

  console.error(agentFailedHint(options.invocation));

  return 1;
};

const resume = (options: {
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

    return workOpenTasks({ root, agent, invocation });
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

  const result = runMigrationPhase({
    root,
    manager,
    pendingUpdate: pending,
    updates,
    from: { ...pending.from, ...argv.from },
    dryRun: argv.dryRun,
    agent,
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

  const agent = args.ai ? readLocalConfig(root).config.updateAgentCommand : undefined;

  if (args.ai && !agent) {
    console.error(
      `--ai needs "${AGENT_COMMAND_KEY}" in ethlete.config.local.json, for example "${AGENT_COMMAND_EXAMPLE}".\n` +
        'Nothing was changed.',
    );

    return 1;
  }

  const manifest = readManifest(root);

  if (!manifest) {
    console.error(`${manifestPath(root)} cannot be read, so there is nothing to update.`);

    return 1;
  }

  const manager = detectPackageManager({ root, manifest });

  const unfinished = args.check ? readPendingUpdate(root) : undefined;

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

    if (agent !== undefined) return workOpenTasks({ root, agent, invocation });

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

  ignoreTaskList(root);

  const changedManifests = writeRanges({ root, writes: writable.flatMap((update) => update.writes) });

  const pendingUpdate: PendingUpdate = {
    startedAt: new Date().toISOString(),
    packages: writable.map((update) => ({ name: update.name, from: update.from ?? null, to: update.to })),
    ...(Object.keys(args.from).length > 0 ? { from: args.from } : {}),
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

  const result = runMigrationPhase({
    root,
    manager,
    pendingUpdate,
    updates: writable,
    from: args.from,
    dryRun: false,
    agent,
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
