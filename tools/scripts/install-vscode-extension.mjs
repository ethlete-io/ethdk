import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Has to hold the same clients as EDITOR_CLIS in libs/timetrack/src/lib/reporter/editors.ts, which is
// what the Sources view offers this command for.
const CLIS = ['code', 'code-insiders', 'codium', 'cursor', 'windsurf'];

const { version } = JSON.parse(readFileSync(resolve('apps/timetrack-vscode/package.json'), 'utf8'));
const vsix = resolve(`dist/apps/timetrack-vscode/timetrack-vscode-${version}.vsix`);

const isOnPath = (cli) => {
  try {
    execFileSync('which', [cli], { stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
};

const editors = (process.env['TIMETRACK_VSCODE_CLI']?.split(',') ?? CLIS).filter(isOnPath);

if (!editors.length) {
  console.error(`None of these editors is on the PATH: ${CLIS.join(', ')}.`);
  console.error(`Install the extension by hand instead: <editor> --install-extension ${vsix} --force`);
  process.exit(1);
}

for (const editor of editors) {
  execFileSync(editor, ['--install-extension', vsix, '--force'], { stdio: 'inherit' });
}

console.log(`\nRestart ${editors.join(' and ')} to load the new build.`);
