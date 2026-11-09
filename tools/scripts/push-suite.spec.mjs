import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { linkTargetOf, missingVerdict, parseArgs, parseLog, runStep } from './push-suite.mjs';

test('defaults the repeat range to the upstream and reads --only', () => {
  assert.deepEqual(parseArgs([]), { only: undefined, range: '@{upstream}..HEAD' });
  assert.deepEqual(parseArgs(['--only', 'repeat', 'origin/next..HEAD']), {
    only: 'repeat',
    range: 'origin/next..HEAD',
  });
});

test('keeps workspace links relative so the export resolves them to its own libs, links the rest to the repo', () => {
  const repo = '/repo';
  assert.equal(linkTargetOf(repo, '/repo/node_modules/@ethlete/core', '../../libs/core'), '../../libs/core');
  assert.equal(
    linkTargetOf(repo, '/repo/node_modules/ethlete-studio', '../apps/ethlete-studio'),
    '../apps/ethlete-studio',
  );
  assert.equal(
    linkTargetOf(repo, '/repo/node_modules/.bin/glob', '../glob/dist/esm/bin.mjs'),
    '/repo/node_modules/.bin/glob',
  );
  assert.equal(
    linkTargetOf(repo, '/repo/libs/cli/node_modules/.bin/tsc', '../typescript/bin/tsc'),
    '/repo/libs/cli/node_modules/.bin/tsc',
  );
  assert.equal(linkTargetOf(repo, '/repo/node_modules/outside', '../../elsewhere'), '/repo/node_modules/outside');
  assert.equal(linkTargetOf(repo, '/repo/node_modules/abs', '/opt/x'), '/repo/node_modules/abs');
  assert.equal(linkTargetOf(repo, '/repo/node_modules/react', undefined), '/repo/node_modules/react');
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

test('a step with a log file writes its output there as it comes and still returns it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'push-suite-log-'));
  const logFile = join(dir, 'handoffs', 'step.log');
  mkdirSync(join(dir, 'handoffs'));
  writeFileSync(logFile, 'stale\n');
  const script = "console.log('out'); setTimeout(() => console.error('err'), 300)";
  const step = runStep(process.execPath, ['-e', script], dir, logFile);

  await new Promise((done) => setTimeout(done, 150));
  assert.equal(readFileSync(logFile, 'utf8'), 'out\n');
  const { output } = await step;
  assert.equal(readFileSync(logFile, 'utf8'), 'out\nerr\n');
  assert.equal(output, 'out\nerr\n');
  rmSync(dir, { recursive: true });
});
