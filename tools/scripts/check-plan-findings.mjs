import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitExec } from './git-test-env.mjs';

const PLAN = 'plans/ethlete-studio/design-to-code.md';
const ARCHIVE_DIR = 'plans/ethlete-studio/archive/';
const KINDS = [
  ['head', /^(\d{3})\\\. /],
  ['as built', /^(\d{3}) as built/],
];

const findingLines = (text) => {
  const found = new Map();
  for (const line of text.split('\n')) {
    for (const [kind, pattern] of KINDS) {
      const match = pattern.exec(line);
      if (match) found.set(`${match[1]} ${kind}`, line);
    }
  }
  return found;
};

/** Finding head and as-built lines in `oldText` that `newText` no longer has and `archivedText` does not hold verbatim. */
export const lostFindings = (oldText, newText, archivedText = '') => {
  const kept = findingLines(newText);
  const archived = new Set(archivedText.split('\n'));
  const lost = [];
  for (const [key, line] of findingLines(oldText)) {
    if (kept.has(key) || archived.has(line)) continue;
    const [number, kind] = [key.slice(0, 3), key.slice(4)];
    lost.push({ number, kind, line });
  }
  return lost;
};

export const refusal = (lost) =>
  `plan finding lines removed from ${PLAN} without archiving: ${lost.map((l) => `${l.number} (${l.kind})`).join(', ')}\n` +
  'append it with `node tools/scripts/archive-findings.mjs`, or restore the lines';

const git = (args) => gitExec(args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });

const stagedInputs = () => {
  const oldText = git(['show', `HEAD:${PLAN}`]);
  const newText = git(['show', `:${PLAN}`]);
  const diff = git(['diff', '--cached', '-U0', '--', ARCHIVE_DIR]);
  const added = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
  return { oldText, newText, added };
};

export const main = (argv, log = console.error) => {
  const [oldFile, newFile, archiveFile] = argv;
  const { oldText, newText, added } = oldFile
    ? {
        oldText: readFileSync(oldFile, 'utf8'),
        newText: readFileSync(newFile, 'utf8'),
        added: archiveFile ? readFileSync(archiveFile, 'utf8') : '',
      }
    : stagedInputs();
  const lost = lostFindings(oldText, newText, added);
  if (lost.length === 0) return 0;
  log(refusal(lost));
  return 1;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
