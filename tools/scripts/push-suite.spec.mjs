import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { blockingDirt, missingVerdict, parseArgs, parseLog } from './push-suite.mjs';

test('defaults the repeat range to the upstream and reads --only', () => {
  assert.deepEqual(parseArgs([]), { only: undefined, range: '@{upstream}..HEAD' });
  assert.deepEqual(parseArgs(['--only', 'repeat', 'origin/next..HEAD']), {
    only: 'repeat',
    range: 'origin/next..HEAD',
  });
});

test('blocks on uncommitted app and lib code, not on plans, ADRs or design pictures', () => {
  assert.deepEqual(
    blockingDirt([
      'apps/ethlete-studio/e2e/canvas.e2e.mjs',
      'libs/cli/src/lib/design/serve.ts',
      'apps/ethlete-studio/docs/adr/0231-x.md',
      '.ethlete/design/studio/pictures.json',
      'plans/ethlete-studio/STATUS.md',
    ]),
    ['apps/ethlete-studio/e2e/canvas.e2e.mjs', 'libs/cli/src/lib/design/serve.ts'],
  );
});

const commits = [
  { sha: 'd2', files: ['plans/ethlete-studio/STATUS.md'] },
  { sha: 'b2', files: ['tools/scripts/push-suite.mjs', '.changeset/x.md'] },
  { sha: 'd1', files: ['apps/ethlete-studio/docs/adr/0231-x.md'] },
  { sha: 'b1', files: ['libs/cli/src/index.ts'] },
];

test('names the newest code commit when no commit at or after it has an ok verdict', () => {
  assert.equal(
    missingVerdict(commits, () => false),
    'b2',
  );
  assert.equal(
    missingVerdict(commits, (sha) => sha === 'b1'),
    'b2',
  );
});

test('lets a push through when the head or a commit after the last code commit has an ok verdict', () => {
  assert.equal(
    missingVerdict(commits, (sha) => sha === 'b2'),
    undefined,
  );
  assert.equal(
    missingVerdict(commits, (sha) => sha === 'd2'),
    undefined,
  );
});

test('lets a push of plans, changesets, ADRs and skills through without a verdict', () => {
  assert.equal(
    missingVerdict([commits[0], commits[2]], () => false),
    undefined,
  );
});

test('reads a captured git log and needs a verdict only for the code commit under a skill edit', () => {
  const log = parseLog(
    readFileSync(join(import.meta.dirname, 'fixtures/push-suite/log-41cb7234d-f835b3fb8.txt'), 'utf8'),
  );

  assert.deepEqual(
    log.map(({ sha, files }) => [sha.slice(0, 9), files.length]),
    [
      ['f835b3fb8', 1],
      ['41cb7234d', 13],
    ],
  );
  assert.equal(
    missingVerdict(log, () => false),
    log[1].sha,
  );
  assert.equal(
    missingVerdict(log.slice(0, 1), () => false),
    undefined,
  );
});
