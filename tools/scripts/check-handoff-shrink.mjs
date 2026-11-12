import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const HANDOFF = /^plans\/(.+\/)?handoff-[^/]*\.md$/;
const OVERRIDE = /shrink handoff/i;

const lineCount = (text) => (text === '' ? 0 : text.replace(/\n$/, '').split('\n').length);

export const isHandoffPath = (path) => HANDOFF.test(path);

export const handoffCuts = (message, changes) =>
  OVERRIDE.test(message)
    ? []
    : changes
        .filter(({ path }) => isHandoffPath(path))
        .map(({ path, before, after }) => ({ path, before: lineCount(before), after: lineCount(after ?? '') }))
        .filter(({ before, after }) => after * 2 < before)
        .map(
          ({ path, before, after }) =>
            `${path}: ${before} -> ${after} lines. Append to a handoff, never overwrite it. ` +
            'Say "shrink handoff" in the commit message when the cut is meant.',
        );

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const stagedHandoffChanges = () =>
  git(['diff', '--cached', '--name-status', '--no-renames', '--diff-filter=MD', '--', 'plans'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .filter(([, path]) => path !== undefined && isHandoffPath(path))
    .map(([status, path]) => ({
      path,
      before: git(['show', `HEAD:${path}`]),
      after: status === 'D' ? '' : git(['show', `:${path}`]),
    }));

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const cuts = handoffCuts(readFileSync(process.argv[2], 'utf8'), stagedHandoffChanges());
  for (const cut of cuts) process.stderr.write(`${cut}\n`);
  if (cuts.length > 0) process.exit(1);
}
