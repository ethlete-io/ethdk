import { execFileSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { PackageManager, detectPackageManager, spawnPackageManager } from './update/package-manager';
import { readManifest } from './update/packages';
import { askQuestion } from './utils';

const NO_CHANGESETS_MESSAGE = 'No unreleased changesets found';

const DEFAULT_COMMIT_MESSAGE = 'Release versions';

export const releaseUsage = (invocation: string) =>
  [
    `Usage: ${invocation} [flags]`,
    '',
    'Turns pending changesets into a release commit, tags it and pushes both.',
    '',
    '  --force, -f          Release although the working tree has uncommitted changes',
    '  --skip-push, -sp     Commit and tag, but do not push',
    `  --message, -m <text> The release commit message (default "${DEFAULT_COMMIT_MESSAGE}")`,
    '  --help, -h           Print this help',
    '',
  ].join('\n');

export type ReleaseFlags = {
  shouldForce: boolean;
  skipPush: boolean;
  message: string;
  help: boolean;
  problems: string[];
};

/** Reads the flags of `et release`, collecting every problem so one run reports them all. */
export const releaseFlags = (args: readonly string[]): ReleaseFlags => {
  const flags: ReleaseFlags = {
    shouldForce: false,
    skipPush: false,
    message: DEFAULT_COMMIT_MESSAGE,
    help: false,
    problems: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    const separator = argument.indexOf('=');
    const flag = separator === -1 ? argument : argument.slice(0, separator);

    if (flag === '--message' || flag === '-m') {
      const value = separator === -1 ? args[++index] : argument.slice(separator + 1);

      if (!value || value.startsWith('-')) flags.problems.push(`${flag} needs a value.`);
      else flags.message = value;
    } else if (separator !== -1) flags.problems.push(`${flag} takes no value.`);
    else if (flag === '--force' || flag === '-f') flags.shouldForce = true;
    else if (flag === '--skip-push' || flag === '-sp') flags.skipPush = true;
    else if (flag === '--help' || flag === '-h') flags.help = true;
    else flags.problems.push(`Unknown flag "${argument}".`);
  }

  return flags;
};

export type WorkingTreeSnapshot = Map<string, string>;

export const pathsChangedBetween = (before: WorkingTreeSnapshot, after: WorkingTreeSnapshot) => {
  const paths = new Set([...before.keys(), ...after.keys()]);

  return [...paths].filter((path) => before.get(path) !== after.get(path));
};

export type CommandResult = { status: number | null; output: string };

export type ReleaseIo = {
  /** Runs a command. `inherit` streams its output to the terminal instead of capturing it. */
  run: (command: readonly string[], options?: { inherit?: boolean }) => CommandResult;
  snapshot: () => WorkingTreeSnapshot;
  ask: (question: string) => Promise<string>;
  log: (message: string) => void;
  error: (message: string) => void;
};

const defaultRun: ReleaseIo['run'] = ([binary = '', ...args], options = {}) => {
  const result =
    binary === 'git'
      ? spawnSync(binary, args, { stdio: options.inherit ? 'inherit' : 'pipe' })
      : spawnPackageManager({ binary, args, spawn: { stdio: options.inherit ? 'inherit' : 'pipe' } });

  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

const snapshotWorkingTree = (): WorkingTreeSnapshot => {
  const entries = execFileSync('git', ['status', '--porcelain', '-z', '-uall']).toString().split('\0').filter(Boolean);

  return new Map(
    entries.map((entry) => {
      const path = entry.slice(3);

      return [path, existsSync(path) ? execFileSync('git', ['hash-object', '--', path]).toString().trim() : 'deleted'];
    }),
  );
};

const defaultIo: ReleaseIo = {
  run: defaultRun,
  snapshot: snapshotWorkingTree,
  ask: askQuestion,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
};

const tagSubcommand = (io: ReleaseIo, changeset: (...args: string[]) => string[]) => {
  const version = io.run(changeset('--version')).output;

  return Number(/(\d+)\.\d+\.\d+/.exec(version)?.[1] ?? 0) >= 3 ? 'git-tag' : 'tag';
};

const CHANGESETS_CLI = '@changesets/cli';

export type ReleaseOptions = {
  args: readonly string[];
  root?: string;
  invocation?: string;
  manager?: PackageManager;
  /** Whether the repo declares `@changesets/cli`. Read from the root `package.json` when left out. */
  hasChangesets?: boolean;
  io?: Partial<ReleaseIo>;
};

/** Runs `et release`: version, commit, tag, push. Resolves to the exit code. */
export const release = async (options: ReleaseOptions): Promise<number> => {
  const root = options.root ?? process.cwd();
  const invocation = options.invocation ?? 'et release';
  const io = { ...defaultIo, ...options.io };
  const flags = releaseFlags(options.args);

  if (flags.problems.length) {
    io.error(`${flags.problems.join('\n')}\n\n${releaseUsage(invocation)}`);

    return 1;
  }

  if (flags.help) {
    io.log(releaseUsage(invocation));

    return 0;
  }

  const manifest = readManifest(root);
  const manager = options.manager ?? detectPackageManager({ root, manifest });
  const hasChangesets =
    options.hasChangesets ??
    Boolean(manifest?.devDependencies?.[CHANGESETS_CLI] ?? manifest?.dependencies?.[CHANGESETS_CLI]);
  const changeset = (...args: string[]) => [...manager.run, 'changeset', ...args];

  if (!hasChangesets) {
    io.error(
      `${CHANGESETS_CLI} is not in the root package.json, so there is nothing to release with. Add it as a dev dependency and run \`${changeset('init').join(' ')}\`.\n`,
    );

    return 1;
  }

  if (io.run(['git', 'status', '--porcelain']).output.trim()) {
    if (!flags.shouldForce) {
      io.error('There are uncommitted changes, aborting...\n');

      return 1;
    }

    io.log('🚨 Proceed with caution 🚨 \n\nForcing release with uncommitted changes...\n');
  }

  const answer = await io.ask(
    'You are about to release a new version. Make sure you are not releasing a version that has already been released on a different branch. \n\n Press enter to continue...\n',
  );

  if (answer !== '') {
    io.error('Aborting...');

    return 1;
  }

  const before = io.snapshot();
  const version = io.run(changeset('version'));

  if (version.status !== 0) {
    io.error(
      version.output.includes(NO_CHANGESETS_MESSAGE)
        ? `${NO_CHANGESETS_MESSAGE}, aborting...\n`
        : `\`${changeset('version').join(' ')}\` failed:\n${version.output}`,
    );

    return 1;
  }

  io.log(version.output);

  const changedPaths = pathsChangedBetween(before, io.snapshot());

  if (changedPaths.length) io.run(['git', 'add', '--', ...changedPaths]);

  io.log('Committing release... 🚀 \n(This may take a while depending on your pre-commit hooks) \n');

  if (io.run(['git', 'commit', '-m', flags.message], { inherit: true }).status !== 0) {
    io.error(
      [
        'git commit failed, so no tag was written. The version bump is staged.',
        `Fix what the hook reported (a commit-msg hook may need \`--message "<text>"\`), commit the staged files,`,
        `then run \`${changeset(tagSubcommand(io, changeset)).join(' ')}\` and \`git push --follow-tags\`.`,
        '',
      ].join('\n'),
    );

    return 1;
  }

  const tag = io.run(changeset(tagSubcommand(io, changeset)));

  if (tag.status !== 0) {
    io.error(`The release commit exists, but tagging it failed:\n${tag.output}`);

    return 1;
  }

  io.log(tag.output);

  if (flags.skipPush) {
    io.log('🚀 Release complete without pushing the commit 🚀 Have a great day ❤️ ');

    return 0;
  }

  if (io.run(['git', 'push', '--follow-tags'], { inherit: true }).status !== 0) {
    io.error('The release commit and its tags exist locally, but `git push --follow-tags` failed.');

    return 1;
  }

  io.log('🚀 Release complete 🚀 Have a great day ❤️');

  return 0;
};
