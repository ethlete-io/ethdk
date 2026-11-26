const { execSync } = require('child_process');

const COMMAND = 'yarn changeset pre enter next';

try {
  execSync(COMMAND, { stdio: 'inherit' });
} catch (error) {
  // Changeset will exit with 1 if we are already in prerelease mode.
  // We don't want to fail the build in this case.
  if (error.status !== 1) {
    throw error;
  }
}
