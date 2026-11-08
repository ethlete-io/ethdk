import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirtyCliNoteOf, ensureCliCopy } from './studio-code.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const { entry, sha, dirty } = ensureCliCopy(root, { keepWhenDirty: false });
const note = dirtyCliNoteOf({ sha, dirty, args });

if (note) console.error(note);

const run = spawnSync('node', [entry, 'design', ...args], { stdio: 'inherit' });

process.exit(run.status ?? 1);
