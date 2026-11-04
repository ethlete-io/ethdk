import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCliCopy } from './studio-code.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { entry } = ensureCliCopy(root, { keepWhenDirty: false });
const run = spawnSync('node', [entry, 'design', ...process.argv.slice(2)], { stdio: 'inherit' });

process.exit(run.status ?? 1);
