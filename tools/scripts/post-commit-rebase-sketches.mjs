import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureCliCopy } from './studio-code.mjs';

const TIMEOUT_MS = 120_000;

/**
 * Whether a commit with these `git diff-tree --name-status` lines changed a design part: a file under `.ethlete/design`
 * outside `sketches/`. A commit that deletes a `sketch.json` is a merge or a discard, which rebases the others itself.
 */
export const changesDesignParts = (lines) => {
  const changes = lines.map((line) => line.split('\t')).filter(([status, path]) => status && path);

  return (
    !changes.some(
      ([status, path]) => status === 'D' && /^\.ethlete\/design\/.*\/sketches\/[^/]+\/sketch\.json$/u.test(path),
    ) && changes.some(([, path]) => path.startsWith('.ethlete/design/') && !path.includes('/sketches/'))
  );
};

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const listed = spawnSync('git', ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });

  if (listed.status !== 0 || !changesDesignParts(listed.stdout.split('\n'))) return;

  const entry =
    process.env.ETHLETE_DESIGN_CLI_ENTRY ??
    ensureCliCopy(root, { keepWhenDirty: false, log: () => undefined, build: null })?.entry ??
    null;

  if (entry === null) {
    console.log('post-commit: no built design CLI for this head - run yarn et:design status to see stale sketches.');

    return;
  }

  const run = spawnSync(process.execPath, [entry, 'design', 'sketch', 'rebase-open', '--commit', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  const lines = (run.stdout ?? '').trim();

  if (run.status !== 0) console.log('post-commit: the sketch rebase did not finish - run yarn et:design status.');
  else if (lines) console.log(`post-commit: sketches this commit made stale:\n${lines}`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.log(`post-commit: the sketch rebase failed (${error.message}) - run yarn et:design status.`);
  }
}
