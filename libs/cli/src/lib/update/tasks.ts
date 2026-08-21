import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { instructionsPath } from './migration-manifest';
import { PackageManager } from './package-manager';
import { UpdatedPackage } from './plan';
import { MigrationOutcome, manualGeneratorCommand } from './run-migrations';

export const UPDATE_DIR = join('.ethlete', 'update');
export const TASKS_FILE = 'tasks.md';
export const TASKS_DATA_FILE = 'tasks.json';
export const DOCS_BASE_URL = 'https://ethlete-sdk-docs.web.app';

export type UpdateTask = {
  packageName: string;
  name: string;
  version: string;
  kind: 'manual' | 'assisted' | 'unsupported';
  description: string;
  /** Repo-relative path of the copied instructions, when the migration ships any. */
  instructionsFile?: string;
  docsUrl?: string;
  /** For an `unsupported` auto migration: the generator command to run by hand. */
  command?: string;
};

const withoutScope = (packageName: string) => packageName.replace('@ethlete/', '');

export const taskFileName = (options: { packageName: string; name: string }) =>
  `${withoutScope(options.packageName)}-${options.name}.md`;

/** The tasks an update leaves behind: what needs a decision, a prompt, or a command Nx could not run. */
export const collectTasks = (options: {
  outcomes: readonly MigrationOutcome[];
  manager: PackageManager;
}): UpdateTask[] => {
  const { outcomes, manager } = options;
  const tasks: UpdateTask[] = [];

  for (const outcome of outcomes) {
    const { migration, packageName, manifestPath } = outcome.pending;
    const source = instructionsPath({ manifestPath, migration });
    const shared = {
      packageName,
      name: migration.name,
      version: migration.version,
      description: migration.description,
      instructionsFile: source ? join(UPDATE_DIR, taskFileName({ packageName, name: migration.name })) : undefined,
      docsUrl: migration.docs ? `${DOCS_BASE_URL}${migration.docs}` : undefined,
    };

    if (outcome.state === 'unsupported') {
      tasks.push({ ...shared, kind: 'unsupported', command: manualGeneratorCommand({ manager, migration }) });
      continue;
    }

    if (outcome.state !== 'task') continue;

    if (migration.kind === 'manual' || migration.kind === 'assisted') tasks.push({ ...shared, kind: migration.kind });
  }

  return tasks;
};

const KIND_HEADINGS: Record<UpdateTask['kind'], string> = {
  unsupported: 'Codemods to run by hand',
  manual: 'Changes that need a decision',
  assisted: 'Changes an agent can make',
};

const renderTask = (task: UpdateTask) =>
  [
    `### ${task.packageName} — ${task.name}`,
    '',
    `Landed in ${task.version}. ${task.description}`,
    ...(task.command ? ['', `Run: \`${task.command}\``] : []),
    ...(task.instructionsFile ? ['', `Instructions: \`${task.instructionsFile}\``] : []),
    ...(task.docsUrl ? ['', `Docs: ${task.docsUrl}`] : []),
    '',
  ].join('\n');

const renderGroup = (kind: UpdateTask['kind'], tasks: readonly UpdateTask[]) => {
  const group = tasks.filter((task) => task.kind === kind);

  if (group.length === 0) return [];

  return [`## ${KIND_HEADINGS[kind]}`, '', ...group.map(renderTask)];
};

export const renderTasks = (options: {
  updates: readonly UpdatedPackage[];
  outcomes: readonly MigrationOutcome[];
  tasks: readonly UpdateTask[];
}) => {
  const { updates, outcomes, tasks } = options;
  const applied = outcomes.filter((outcome) => outcome.state === 'applied');
  const failed = outcomes.filter((outcome) => outcome.state === 'failed');

  return [
    '# Ethlete update: what is left to do',
    '',
    '`et update` moved these packages:',
    '',
    ...updates.map((update) => `- \`${update.name}\`: ${update.from ?? 'not installed'} → ${update.to}`),
    '',
    ...(applied.length > 0
      ? [
          'It applied these codemods:',
          '',
          ...applied.map(
            (outcome) =>
              `- \`${outcome.pending.packageName}\` ${outcome.pending.migration.name} (${outcome.pending.migration.generator})`,
          ),
          '',
        ]
      : []),
    ...(failed.length > 0
      ? [
          'These codemods failed. Run each one again by hand and read its output:',
          '',
          ...failed.map(
            (outcome) => `- \`${outcome.pending.packageName}\` ${outcome.pending.migration.name} — ${outcome.reason}`,
          ),
          '',
        ]
      : []),
    ...(tasks.length === 0
      ? ['Nothing else needs a decision.', '']
      : [
          'Everything below needs a decision the codemods cannot make.',
          '',
          ...renderGroup('unsupported', tasks),
          ...renderGroup('manual', tasks),
          ...renderGroup('assisted', tasks),
        ]),
  ].join('\n');
};

/**
 * One task as its own file: what moved and where to read more, then the instructions the package ships.
 * The header is what makes the file readable on its own once the update is over.
 */
export const renderTaskFile = (options: { task: UpdateTask; instructions: string }) => {
  const { task, instructions } = options;

  return [
    `<!-- Written by et update. ${task.packageName} ${task.version}, migration "${task.name}". -->`,
    '',
    ...(task.kind === 'assisted'
      ? ['> Hand this file to an agent. It describes one change to apply across this repository.', '']
      : []),
    `- Package: \`${task.packageName}\``,
    `- Landed in: ${task.version}`,
    `- Summary: ${task.description}`,
    ...(task.docsUrl ? [`- Docs: ${task.docsUrl}`] : []),
    '',
    '---',
    '',
    instructions.trim(),
  ].join('\n');
};

export type WrittenTasks = {
  /** Repo-relative path of the report. */
  reportPath: string;
  dataPath: string;
  tasks: UpdateTask[];
};

/**
 * Writes the report, the machine-readable task list an agent reads, and a copy of every instructions
 * file, so the whole task list stands on its own once `node_modules` changes again.
 */
export const writeUpdateTasks = (options: {
  root: string;
  updates: readonly UpdatedPackage[];
  outcomes: readonly MigrationOutcome[];
  manager: PackageManager;
  generatedAt: string;
}): WrittenTasks => {
  const { root, updates, outcomes, manager, generatedAt } = options;
  const tasks = collectTasks({ outcomes, manager });
  const directory = join(root, UPDATE_DIR);

  mkdirSync(directory, { recursive: true });

  for (const outcome of outcomes) {
    const source = instructionsPath({
      manifestPath: outcome.pending.manifestPath,
      migration: outcome.pending.migration,
    });
    const task = tasks.find(
      (candidate) =>
        candidate.packageName === outcome.pending.packageName && candidate.name === outcome.pending.migration.name,
    );

    if (!source || !task) continue;

    writeFileSync(
      join(directory, taskFileName({ packageName: task.packageName, name: task.name })),
      `${renderTaskFile({ task, instructions: readFileSync(source, 'utf8') })}\n`,
      'utf8',
    );
  }

  const reportPath = join(UPDATE_DIR, TASKS_FILE);
  const dataPath = join(UPDATE_DIR, TASKS_DATA_FILE);

  writeFileSync(join(root, reportPath), `${renderTasks({ updates, outcomes, tasks })}\n`, 'utf8');
  writeFileSync(
    join(root, dataPath),
    `${JSON.stringify(
      {
        generatedAt,
        updates: updates.map((update) => ({ package: update.name, from: update.from ?? null, to: update.to })),
        applied: outcomes
          .filter((outcome) => outcome.state === 'applied')
          .map((outcome) => ({
            package: outcome.pending.packageName,
            name: outcome.pending.migration.name,
            generator: outcome.pending.migration.generator ?? null,
          })),
        failed: outcomes
          .filter((outcome) => outcome.state === 'failed')
          .map((outcome) => ({
            package: outcome.pending.packageName,
            name: outcome.pending.migration.name,
            reason: outcome.reason ?? null,
          })),
        tasks,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return { reportPath, dataPath, tasks };
};
