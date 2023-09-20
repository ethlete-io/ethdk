import { execSync } from 'child_process';
import { askQuestion } from './utils';

export const release = async (args: string[]) => {
  const shouldForce = args.findIndex((arg) => arg.includes('--force') || arg.includes('-f')) !== -1;
  const skipPush = args.findIndex((arg) => arg.includes('--skip-push') || arg.includes('-sp')) !== -1;

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

  const changesetVersion = execSync('yarn changeset version').toString();

  console.log(changesetVersion);

  const changesetTag = execSync('yarn changeset tag').toString();

  console.log(changesetTag);

  execSync('git add .');

  console.log('Committing release... 🚀 \n(This may take a while depending on your pre-commit hooks) \n');

  execSync(`git commit -m "Release versions"`);

  if (!skipPush) {
    execSync('git push --follow-tags');
    console.log('🚀 Release complete 🚀 Have a great day ❤️');
  } else {
    console.log('🚀 Release complete without pushing the commit 🚀 Have a great day ❤️ ');
  }
};
