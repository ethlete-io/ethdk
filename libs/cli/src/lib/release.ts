import { execFileSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import { askQuestion } from './utils';

const NO_CHANGESETS_MESSAGE = 'No unreleased changesets found';

const changesetMajorVersion = () => {
  const version = execSync('yarn changeset --version').toString();

  return Number(/(\d+)\.\d+\.\d+/.exec(version)?.[1] ?? 0);
};

const runChangesetVersion = () => {
  try {
    return execSync('yarn changeset version', { stdio: 'pipe' }).toString();
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    const output = `${stdout ?? ''}${stderr ?? ''}`;

    if (!output.includes(NO_CHANGESETS_MESSAGE)) throw error;

    console.error(`${NO_CHANGESETS_MESSAGE}, aborting...\n`);
    process.exit(1);
  }
};

export type WorkingTreeSnapshot = Map<string, string>;

export const pathsChangedBetween = (before: WorkingTreeSnapshot, after: WorkingTreeSnapshot) => {
  const paths = new Set([...before.keys(), ...after.keys()]);

  return [...paths].filter((path) => before.get(path) !== after.get(path));
};

const snapshotWorkingTree = (): WorkingTreeSnapshot => {
  const entries = execSync('git status --porcelain -z -uall').toString().split('\0').filter(Boolean);

  return new Map(
    entries.map((entry) => {
      const path = entry.slice(3);

      return [path, existsSync(path) ? execFileSync('git', ['hash-object', '--', path]).toString().trim() : 'deleted'];
    }),
  );
};

export const releaseFlags = (args: string[]) => ({
  shouldForce: args.includes('--force') || args.includes('-f'),
  skipPush: args.includes('--skip-push') || args.includes('-sp'),
});

export const release = async (args: string[]) => {
  const { shouldForce, skipPush } = releaseFlags(args);

  const status = execSync('git status --porcelain').toString();

  if (status) {
    if (shouldForce) {
      console.warn('🚨 Proceed with caution 🚨 \n\nForcing release with uncommitted changes...\n');
    } else {
      console.error('There are uncommitted changes, aborting...\n');
      process.exit(1);
    }
  }

  const answer = await askQuestion(
    'You are about to release a new version. Make sure you are not releasing a version that has already been released on a different branch. \n\n Press enter to continue...\n',
  );

  if (answer !== '') {
    console.error('Aborting...');
    process.exit(1);
  }

  const before = snapshotWorkingTree();

  console.log(runChangesetVersion());

  const changesetTag = execSync(`yarn changeset ${changesetMajorVersion() >= 3 ? 'git-tag' : 'tag'}`).toString();

  console.log(changesetTag);

  const changedPaths = pathsChangedBetween(before, snapshotWorkingTree());

  if (changedPaths.length) execFileSync('git', ['add', '--', ...changedPaths]);

  console.log('Committing release... 🚀 \n(This may take a while depending on your pre-commit hooks) \n');

  execSync(`git commit -m "Release versions"`);

  if (!skipPush) {
    execSync('git push --follow-tags');
    console.log('🚀 Release complete 🚀 Have a great day ❤️');
  } else {
    console.log('🚀 Release complete without pushing the commit 🚀 Have a great day ❤️ ');
  }
};
