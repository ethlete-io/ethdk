import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  failureReport,
  linkTargetOf,
  missingVerdict,
  parseArgs,
  parseLog,
  reexecCommand,
  runStep,
  STEPS,
  touchedProjects,
  withTarget,
} from './push-suite.mjs';

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

test('a failed step reports every failed row of a captured run, also one far above the last 40 lines', () => {
  const output = readFileSync(join(import.meta.dirname, 'fixtures/push-suite/e2e-failed.txt'), 'utf8');
  const report = failureReport(output).split('\n');

  assert.ok(report.some((line) => /^\s+✘\s+9 \[Large\] › a sketch scroll never empties a cell/.test(line)));
  assert.deepEqual(report.slice(-40), output.split('\n').slice(-40));
  assert.equal(report.filter((line) => line.includes('✓')).length, 0);
});

test('a failed vitest spec reports its FAIL row, with and without colors', () => {
  const filler = Array.from({ length: 45 }, (_, index) => `later line ${index}`);
  for (const name of ['vitest-failed.txt', 'vitest-failed-color.txt']) {
    const fixture = readFileSync(join(import.meta.dirname, 'fixtures/push-suite', name), 'utf8');
    const report = failureReport([...fixture.split('\n'), ...filler].join('\n')).split('\n');
    const row = report.find((line) => line.includes('FAIL'));

    assert.ok(row, name);
    assert.match(row.replace(/\x1b\[[0-9;]*m/g, ''), /FAIL\s+a\.spec\.mjs > serve > fails here/);
    assert.equal(report.length, 41);
  }
});

test('the suite re-runs itself from the export, so every gate script is the committed one', () => {
  const plan = reexecCommand('/tmp/export', '/repo', { only: 'repeat', range: 'a..b' }, { PATH: 'x' });

  assert.deepEqual(plan.args, ['/tmp/export/tools/scripts/push-suite.mjs', '--only', 'repeat', 'a..b']);
  assert.equal(plan.env.PUSH_SUITE_REPO, '/repo');
  assert.equal(plan.env.PUSH_SUITE_EXPORT, '/tmp/export');
  assert.deepEqual(reexecCommand('/e', '/r', { range: 'a..b' }, {}).args.slice(1), ['a..b']);
});

test('push-suite imports no sibling script at load time, so no live gate code runs before the re-exec', () => {
  const source = readFileSync(join(import.meta.dirname, 'push-suite.mjs'), 'utf8');

  assert.deepEqual(source.match(/^import .* from '\.\/.*';$/gm) ?? [], []);
});

test('typechecks only the touched projects that have a typecheck target, right after lint', () => {
  const projects = { 'libs/cli/project.json': 'cli', 'apps/ethlete-studio/project.json': 'ethlete-studio' };
  const exists = (path) => Object.keys(projects).some((file) => path.endsWith(file));
  const read = (path) => JSON.stringify({ name: Object.entries(projects).find(([file]) => path.endsWith(file))[1] });
  const touched = touchedProjects(
    ['apps/ethlete-studio/src/a.ts', 'libs/cli/src/b.ts', 'libs/cli/c.ts', 'plans/x.md', 'package.json', 'tools/x.mjs'],
    read,
    exists,
  );

  assert.deepEqual(touched, ['cli', 'ethlete-studio']);
  assert.deepEqual(withTarget(touched, ['core', 'ethlete-studio']), ['ethlete-studio']);
  assert.deepEqual(STEPS.slice(0, 2), ['lint', 'typecheck']);
});
