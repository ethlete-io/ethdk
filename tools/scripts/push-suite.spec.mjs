import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { gitEnv } from './git-test-env.mjs';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { linkTargetOf } from './commit-export.mjs';
import { CHECKS } from './pre-push-checks.mjs';
import {
  failureReport,
  otherProcessWarningLines,
  otherTestProcessesOf,
  parseArgs,
  pushSuite,
  reexecCommand,
  sampleMaxLoad,
  waitForLowLoad,
  STEPS,
  stepLine,
  touchedProjects,
  withTarget,
} from './push-suite.mjs';

test('defaults the range to the upstream and reads --only', () => {
  assert.deepEqual(parseArgs([]), { only: undefined, range: '@{upstream}..HEAD' });
  assert.deepEqual(parseArgs(['--only', 'lint,tools', 'origin/next..HEAD']), {
    only: 'lint,tools',
    range: 'origin/next..HEAD',
  });
});

test('--only refuses a step outside the fast set before it takes any lock', async () => {
  const lines = [];

  assert.equal(await pushSuite({ only: 'lint,e2e', range: 'HEAD..HEAD' }, (line) => lines.push(line)), 1);
  assert.deepEqual(lines, ['push-suite: blocked unknown step e2e, expected one of lint, typecheck, tools']);
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
    assert.match(stripVTControlCharacters(row), /FAIL\s+a\.spec\.mjs > serve > fails here/);
    assert.equal(report.length, 41);
  }
});

test('the suite re-runs itself from the export, so every gate script is the committed one', () => {
  const plan = reexecCommand('/tmp/export', '/repo', { only: 'lint,tools', range: 'a..b' }, { PATH: 'x' });

  assert.deepEqual(plan.args, ['/tmp/export/tools/scripts/push-suite.mjs', '--only', 'lint,tools', 'a..b']);
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

const loadHarness = (loads, limit = 4) => {
  let time = 0;
  const lines = [];
  const slept = [];
  return {
    lines,
    slept,
    options: {
      limit,
      log: (line) => lines.push(line),
      load: () => loads[Math.min(Math.floor(time / 15_000), loads.length - 1)],
      now: () => time,
      sleep: async (ms) => {
        slept.push(ms);
        time += ms;
      },
    },
  };
};

test('waits to start while the load is above the limit, then starts', async () => {
  const { lines, slept, options } = loadHarness([9, 6, 2]);
  await waitForLowLoad(options);

  assert.equal(slept.length, 2);
  assert.deepEqual(lines, [
    'push-suite: waiting to start, load 9.0 is above the limit 4',
    'push-suite: waiting to start, load 6.0 is above the limit 4',
  ]);
});

test('starts at once when the load is at or below the limit', async () => {
  const { lines, slept, options } = loadHarness([4]);
  await waitForLowLoad(options);

  assert.deepEqual([lines, slept], [[], []]);
});

test('starts anyway after the maximum wait and says it starts under load', async () => {
  const { lines, options } = loadHarness([20]);
  await waitForLowLoad(options, { pollMs: 15_000, maxWaitMs: 45_000 });

  assert.equal(lines.length, 4);
  assert.equal(lines.at(-1), 'push-suite: starting under load 20.0 (limit 4) after 45 s of waiting');
});

test('a failed step line names the load average, an ok one does not', () => {
  assert.equal(
    stepLine('e2e', 1, 60_000, undefined, 18.24, 42),
    'push-suite: e2e failed at load 18.2 (max 42.0 during the step) in 60 s',
  );
  assert.equal(stepLine('cli', 0, 5_000, undefined, 18.24), 'push-suite: cli ok in 5 s');
});

test('samples the load while a step runs and reports the peak, not the end value', () => {
  let tick;
  let cleared = false;
  const loads = [3, 42, 5, 2];
  const stop = sampleMaxLoad(() => loads.shift(), {
    every: (fn) => {
      tick = fn;
      return 1;
    },
    clear: () => {
      cleared = true;
    },
  });
  tick();
  tick();

  assert.equal(stop(), 42);
  assert.equal(cleared, true);
});

const sh = (cwd, command, args) => {
  const run = spawnSync(command, args, { cwd, encoding: 'utf8', env: gitEnv() });
  assert.equal(run.status, 0, run.stderr);
  return run;
};

const checksFixture = () => {
  const repo = mkdtempSync(join(tmpdir(), 'push-suite-checks-'));
  const here = import.meta.dirname;
  const scripts = Object.fromEntries(CHECKS.map((check) => [check, 'node -e 0']));
  scripts['lint:changeset-coverage'] = 'node -e 0';
  scripts['lint:runner-os'] = 'node ./tools/scripts/check-runner-os-paths.mjs';
  mkdirSync(join(repo, 'tools/scripts'), { recursive: true });
  mkdirSync(join(repo, '.husky'));
  mkdirSync(join(repo, '.github/workflows'), { recursive: true });
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts }));
  writeFileSync(join(repo, 'yarn.lock'), '');
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  copyFileSync(join(here, 'check-runner-os-paths.mjs'), join(repo, 'tools/scripts/check-runner-os-paths.mjs'));
  copyFileSync(join(here, 'lint-changesets.js'), join(repo, 'tools/scripts/lint-changesets.js'));
  copyFileSync(join(here, '../../.husky/format-check-committed.mjs'), join(repo, '.husky/format-check-committed.mjs'));
  symlinkSync(join(here, '../../node_modules'), join(repo, 'node_modules'));
  sh(repo, 'git', ['init', '-q']);
  sh(repo, 'git', ['config', 'user.email', 't@example.com']);
  sh(repo, 'git', ['config', 'user.name', 't']);
  sh(repo, 'git', ['add', '.']);
  sh(repo, 'git', ['commit', '-q', '-m', 'base']);
  writeFileSync(
    join(repo, '.github/workflows/ci.yml'),
    'jobs:\n  a:\n    steps:\n      - run: cat /proc/self/cgroup\n',
  );
  sh(repo, 'git', ['add', '.github']);
  sh(repo, 'git', ['commit', '-q', '-m', 'workflow']);
  return repo;
};

test('push:suite stops at the checks step when a range only a pre-push check refuses, before any spec runs', () => {
  const repo = checksFixture();
  const lockDir = mkdtempSync(join(tmpdir(), 'push-suite-lock-'));
  try {
    const run = spawnSync(process.execPath, [join(import.meta.dirname, 'push-suite.mjs'), 'HEAD~1..HEAD'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PUSH_SUITE_REPO: repo,
        PUSH_SUITE_MAX_LOAD: '1000',
        PUSH_SUITE_EXPORT: '',
        ETHLETE_HEAVY_LOCK_FILE: join(lockDir, 'heavy.lock'),
      },
      timeout: 120_000,
    });
    const output = `${run.stdout}${run.stderr}`;

    assert.equal(run.status, 1, output);
    assert.match(output, /pre-push: lint:runner-os failed:/);
    assert.match(output, /Linux-only path outside a Linux branch/);
    assert.match(output, /push-suite: blocked pre-push checks failed \(lint:runner-os\)/);
    assert.doesNotMatch(output, /push-suite: (exported|lint|typecheck|cli) /);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(lockDir, { recursive: true, force: true });
  }
});

const ROOT = '/home/tom/dev/app-a';
const SAMPLE = [
  { pid: 100, ppid: 1, cpu: 0, cwd: ROOT, args: 'node /usr/bin/yarn push:suite' },
  { pid: 101, ppid: 100, cpu: 3, cwd: ROOT, args: 'node tools/scripts/push-suite.mjs' },
  { pid: 102, ppid: 101, cpu: 40, cwd: ROOT, args: 'node /usr/lib/node_modules/nx/bin/nx.js run cli:test' },
  { pid: 200, ppid: 1, cpu: 55, cwd: ROOT, args: `node ${ROOT}/node_modules/vitest/vitest.mjs run` },
  { pid: 201, ppid: 1, cpu: 4, cwd: ROOT, args: `node ${ROOT}/node_modules/nx/dist/src/daemon/server/start.js` },
  {
    pid: 300,
    ppid: 1,
    cpu: 1,
    cwd: ROOT,
    args: 'node /opt/cli/src/index.js design __resident --checkout /home/tom/dev/app-a',
  },
  {
    pid: 301,
    ppid: 300,
    cpu: 2,
    cwd: ROOT,
    args: '/home/tom/.cache/ms-playwright/chromium-1/chrome-headless-shell --disable-field-trial-config',
  },
  { pid: 400, ppid: 1, cpu: 1, cwd: ROOT, args: '/ext/typescript-linux-x64/lib/tsc --lsp --stdio' },
  { pid: 500, ppid: 1, cpu: 70, cwd: '/home/tom/dev/app-b', args: 'node /usr/lib/node_modules/vitest/vitest.mjs run' },
  { pid: 501, ppid: 1, cpu: 70, cwd: null, args: 'node /usr/lib/node_modules/vitest/vitest.mjs run' },
  {
    pid: 502,
    ppid: 1,
    cpu: 9,
    cwd: `${ROOT}/libs/core`,
    args: 'node /usr/lib/node_modules/typescript/bin/tsc -p tsconfig.json',
  },
];

test('other test or build work of this checkout is selected, not the suite itself, servers or other checkouts', () => {
  const found = otherTestProcessesOf({ processes: SAMPLE, root: ROOT, selfPid: 101 });

  assert.deepEqual(
    found.map(({ pid }) => pid),
    [200, 502],
  );
});

test('the warning is one header and one line per process', () => {
  const found = otherTestProcessesOf({ processes: SAMPLE, root: ROOT, selfPid: 101 });
  const lines = otherProcessWarningLines(found, ROOT);

  assert.equal(lines[0], 'push-suite: warning: 2 other test or build process(es) of this checkout run:');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^ {2}200 {3}55\.0 % cpu {2}node node_modules\/vitest\/vitest\.mjs run$/);
});
