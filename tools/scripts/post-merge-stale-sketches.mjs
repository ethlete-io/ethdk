import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCliCopy } from './studio-code.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TIMEOUT_MS = 20_000;

const entryOf = () => {
  if (process.env.ETHLETE_DESIGN_CLI_ENTRY) return process.env.ETHLETE_DESIGN_CLI_ENTRY;

  return ensureCliCopy(root, { keepWhenDirty: false, log: () => undefined, build: null })?.entry ?? null;
};

try {
  const entry = entryOf();

  if (entry === null) {
    console.log('post-merge: no built design CLI for this head - run yarn et:design status to see stale sketches.');
  } else {
    const run = spawnSync(process.execPath, [entry, 'design', 'status', '--stale'], {
      cwd: root,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
    });
    const lines = (run.stdout ?? '').trim();

    if (run.status !== 0) {
      console.log('post-merge: the stale-sketch check did not finish - run yarn et:design status.');
    } else if (lines) {
      console.log(`post-merge: sketches whose base is stale:\n${lines}`);
    }
  }
} catch (error) {
  console.log(`post-merge: the stale-sketch check failed (${error.message}) - run yarn et:design status.`);
}
