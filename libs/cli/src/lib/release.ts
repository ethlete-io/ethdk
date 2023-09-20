import { execSync } from 'child_process';
import { askQuestion } from './utils';

export const release = async () => {
  const status = execSync('git status --porcelain').toString();

  if (status) {
    console.error('There are uncommitted changes, aborting...');
    process.exit(1);
  }

  const answer = await askQuestion(
    'You are about to release a new version. Make sure you are not releasing a version that has already been released on a different branch. \n Press enter to continue...',
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
  execSync(`git commit -m "Release versions"`);
  execSync('git push');

  console.log('Release complete, have a great day ❤️');
};
