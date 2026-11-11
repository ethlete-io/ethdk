import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CHECKS } from './pre-push-checks.mjs';
import {
  e2eQuotaCommand,
  e2eQuotaStep,
  failureReport,
  linkTargetOf,
  missingVerdict,
  parseArgs,
  parseLog,
  quotaCommand,
  quotaSpecFiles,
  quotaStep,
  reexecCommand,
  runStep,
  sampleMaxLoad,
  waitForLowLoad,
  STEPS,
  stepLine,
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

test('the quota step takes only the changed Studio spec files', () => {
  assert.deepEqual(
    quotaSpecFiles([
      'apps/ethlete-studio/src/b.spec.ts',
      'apps/ethlete-studio/src/a.ts',
      'apps/ethlete-studio/e2e/c.e2e.mjs',
      'libs/cli/src/d.spec.ts',
      'apps/ethlete-studio/src/a.spec.ts',
    ]),
    ['apps/ethlete-studio/src/a.spec.ts', 'apps/ethlete-studio/src/b.spec.ts'],
  );
});

test('on darwin the quota step runs one spec file under the cpu throttle', () => {
  assert.deepEqual(quotaCommand('apps/ethlete-studio/src/a.spec.ts', 15, 'darwin'), {
    command: 'node',
    args: [
      'tools/scripts/cpu-throttle.mjs',
      '15',
      '--',
      'npx',
      'vitest',
      'run',
      '--root',
      'apps/ethlete-studio',
      '--maxWorkers=1',
      'src/a.spec.ts',
    ],
  });
});

test('the quota step runs one spec file in a user scope with a CPU quota', () => {
  assert.deepEqual(quotaCommand('apps/ethlete-studio/src/a.spec.ts', 15, 'linux'), {
    command: 'systemd-run',
    args: [
      '--user',
      '--scope',
      '--quiet',
      '-p',
      'CPUQuota=15%',
      'npx',
      'vitest',
      'run',
      '--root',
      'apps/ethlete-studio',
      '--maxWorkers=1',
      'src/a.spec.ts',
    ],
  });
});

const quotaHarness = (durations, statuses = {}) => {
  let time = 0;
  const ran = [];
  return {
    ran,
    os: 'linux',
    now: () => time,
    run: async (command, args) => {
      const file = args.at(-1);
      ran.push(file);
      time += durations[file] ?? 0;
      return { status: statuses[file] ?? 0, output: `out ${file}` };
    },
  };
};

test('the quota step names the quota and the files it ran', async () => {
  const harness = quotaHarness({});
  const result = await quotaStep(['apps/ethlete-studio/a.spec.ts', 'apps/ethlete-studio/b.spec.ts'], {
    ...harness,
    quota: 15,
    available: () => true,
  });

  assert.equal(result.status, 0);
  assert.equal(result.note, 'CPUQuota=15%, ran apps/ethlete-studio/a.spec.ts, apps/ethlete-studio/b.spec.ts');
});

test('the quota step stops starting files at the budget and names the skipped ones', async () => {
  const harness = quotaHarness({ 'a.spec.ts': 100_000, 'b.spec.ts': 100_000 });
  const files = ['apps/ethlete-studio/a.spec.ts', 'apps/ethlete-studio/b.spec.ts', 'apps/ethlete-studio/c.spec.ts'];
  const result = await quotaStep(files, { ...harness, quota: 15, budgetMs: 180_000, available: () => true });

  assert.deepEqual(harness.ran, ['a.spec.ts', 'b.spec.ts']);
  assert.equal(result.status, 0);
  assert.match(result.note, /over the 180 s budget, skipped apps\/ethlete-studio\/c\.spec\.ts$/);
});

test('a failed file fails the quota step with its output', async () => {
  const harness = quotaHarness({}, { 'a.spec.ts': 1 });
  const result = await quotaStep(['apps/ethlete-studio/a.spec.ts', 'apps/ethlete-studio/b.spec.ts'], {
    ...harness,
    available: () => true,
  });

  assert.deepEqual(harness.ran, ['a.spec.ts']);
  assert.equal(result.status, 1);
  assert.equal(result.output, 'out a.spec.ts');
});

test('without systemd-run the quota step passes and says it skipped on this OS', async () => {
  const harness = quotaHarness({});
  const result = await quotaStep(['apps/ethlete-studio/a.spec.ts'], {
    ...harness,
    available: () => false,
    os: 'win32',
  });

  assert.deepEqual(harness.ran, []);
  assert.equal(result.status, 0);
  assert.match(result.note, /^skipped on win32: the CPU quota needs systemd-run --user/);
});

test('the quota step runs after the Studio unit tests', () => {
  assert.equal(STEPS.indexOf('quota'), STEPS.indexOf('studio') + 1);
});

test('the e2e quota step runs one changed case on one worker in a user scope with a CPU quota', () => {
  assert.deepEqual(e2eQuotaCommand('Tab focus shows the ring', '/tmp/built', 40), {
    command: 'systemd-run',
    args: [
      '--user',
      '--scope',
      '--quiet',
      '-p',
      'CPUQuota=40%',
      process.execPath,
      'apps/ethlete-studio/e2e/canvas.e2e.mjs',
      '--built',
      '/tmp/built',
      '--no-timings',
      '--workers',
      '1',
      '--case',
      'Tab focus shows the ring',
    ],
  });
});

const e2eQuotaHarness = (durations, statuses = {}) => {
  let time = 0;
  const ran = [];
  return {
    ran,
    built: '/tmp/built',
    now: () => time,
    build: async () => {
      ran.push('build');
      return { status: 0, output: '' };
    },
    run: async (command, args) => {
      const name = args.at(-1);
      ran.push(name);
      time += durations[name] ?? 0;
      return { status: statuses[name] ?? 0, output: `out ${name}` };
    },
  };
};

const changedCases = (...cases) => ({ all: false, cases, reasons: [] });

test('the e2e quota step builds Studio once, then runs each changed case and names the quota', async () => {
  const harness = e2eQuotaHarness({});
  const result = await e2eQuotaStep(changedCases('a', 'b'), { ...harness, available: () => true });

  assert.deepEqual(harness.ran, ['build', 'a', 'b']);
  assert.equal(result.status, 0);
  assert.equal(result.note, 'CPUQuota=50%, ran a, b');
});

test('the e2e quota step stops starting cases at its budget and names the skipped ones', async () => {
  const harness = e2eQuotaHarness({ a: 200_000, b: 200_000 });
  const result = await e2eQuotaStep(changedCases('a', 'b', 'c'), { ...harness, available: () => true });

  assert.deepEqual(harness.ran, ['build', 'a', 'b']);
  assert.equal(result.status, 0);
  assert.equal(result.note, 'CPUQuota=50%, ran a, b; over the 300 s budget, skipped c');
});

test('a case that fails under the quota fails the e2e quota step with its output', async () => {
  const harness = e2eQuotaHarness({}, { a: 1 });
  const result = await e2eQuotaStep(changedCases('a', 'b'), { ...harness, available: () => true });

  assert.deepEqual(harness.ran, ['build', 'a']);
  assert.equal(result.status, 1);
  assert.equal(result.output, 'out a');
  assert.equal(result.note, 'CPUQuota=50%, failed a');
});

test('a change outside a case runs no e2e case under the quota and says why', async () => {
  const harness = e2eQuotaHarness({});
  const result = await e2eQuotaStep(
    { all: true, cases: [], reasons: ['libs/cli/src/lib/design/serve.ts serves every page'] },
    { ...harness, available: () => true },
  );

  assert.deepEqual(harness.ran, []);
  assert.equal(result.status, 0);
  assert.match(result.note, /^no case run under the quota: libs\/cli\/src\/lib\/design\/serve\.ts serves every page/);
});

test('without systemd-run the e2e quota step passes and says it skipped on this OS', async () => {
  const harness = e2eQuotaHarness({});
  const result = await e2eQuotaStep(changedCases('a'), { ...harness, available: () => false, os: 'darwin' });

  assert.deepEqual(harness.ran, []);
  assert.equal(result.status, 0);
  assert.match(result.note, /^skipped on darwin: the CPU quota needs systemd-run --user/);
});

test('the e2e quota step runs after the e2e suite passes unthrottled', () => {
  assert.equal(STEPS.indexOf('e2e-quota'), STEPS.indexOf('e2e') + 1);
});

const sh = (cwd, command, args) => {
  const run = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run;
};

const checksFixture = () => {
  const repo = mkdtempSync(join(tmpdir(), 'push-suite-checks-'));
  const here = import.meta.dirname;
  const scripts = Object.fromEntries(CHECKS.map((check) => [check, 'node -e 0']));
  scripts['lint:runner-os'] = 'node ./tools/scripts/check-runner-os-paths.mjs';
  mkdirSync(join(repo, 'tools/scripts'), { recursive: true });
  mkdirSync(join(repo, '.husky'));
  mkdirSync(join(repo, '.github/workflows'), { recursive: true });
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts }));
  writeFileSync(join(repo, 'yarn.lock'), '');
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  copyFileSync(join(here, 'check-runner-os-paths.mjs'), join(repo, 'tools/scripts/check-runner-os-paths.mjs'));
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
  try {
    const run = spawnSync(process.execPath, [join(import.meta.dirname, 'push-suite.mjs'), 'HEAD~1..HEAD'], {
      encoding: 'utf8',
      env: { ...process.env, PUSH_SUITE_REPO: repo, PUSH_SUITE_MAX_LOAD: '1000', PUSH_SUITE_EXPORT: '' },
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
  }
});
