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
  pushSuiteRemotes,
  remoteSuiteLine,
  remoteVerdict,
  reexecCommand,
  remoteRunArgv,
  runOnRemotes,
  runStepUnderLoad,
  sampleMaxLoad,
  waitForLowLoad,
  STEPS,
  COVERAGE_LIBS,
  coverageLibs,
  stepLine,
} from './push-suite.mjs';

test('defaults the range to the upstream and reads --only', () => {
  assert.deepEqual(parseArgs([]), { only: undefined, range: '@{upstream}..HEAD' });
  assert.deepEqual(parseArgs(['--only', 'lint,tools', 'origin/next..HEAD']), {
    only: 'lint,tools',
    range: 'origin/next..HEAD',
  });
});

test('reads the machine and the planned projects a remote checkout runs without a range', () => {
  assert.deepEqual(
    parseArgs(['--only', 'lint', '--on', 'rack', '--lint-projects=a,b', '--coverage-libs=', '--max-load', '9', 'HEAD']),
    { only: 'lint', range: 'HEAD', maxLoad: 9, on: 'rack', lintProjects: ['a', 'b'], coverageLibs: [] },
  );
});

test('tries no remote while tank is free, rack and then mac while it is not, and only the machine --on names', () => {
  const remotes = (on, tankFree) => pushSuiteRemotes({ on, tankIsFree: () => tankFree });

  assert.deepEqual(remotes(undefined, true), []);
  assert.deepEqual(remotes(undefined, false), ['rack', 'mac']);
  assert.deepEqual(remotes('rack', true), ['rack']);
  assert.deepEqual(remotes('mac', true), ['mac']);
  assert.deepEqual(remotes('tank', false), []);
});

test('an unusable rack or a rack run without a verdict moves on to mac before tank', async () => {
  const pass = async (rackUp, verdicts) => {
    const lines = [];
    const ran = [];
    const status = await runOnRemotes({
      remotes: ['rack', 'mac'],
      health: (machine) =>
        machine === 'mac' || rackUp ? { usable: true } : { usable: false, reason: 'has 3.0 GB free on C:' },
      runOn: async (machine) => (ran.push(machine), verdicts[machine]),
      log: (line) => lines.push(line),
    });
    return { status, ran, lines };
  };

  assert.deepEqual(await pass(false, { mac: 0 }), {
    status: 0,
    ran: ['mac'],
    lines: ['push-suite: rack has 3.0 GB free on C:, skipping it'],
  });
  assert.deepEqual((await pass(true, { rack: undefined, mac: 1 })).ran, ['rack', 'mac']);
  assert.deepEqual(await pass(true, {}), {
    status: undefined,
    ran: ['rack', 'mac'],
    lines: ['push-suite: no remote machine gave a verdict, running on tank'],
  });
});

test('mac runs the suite natively, without the Linux container or the rack yarn cache', () => {
  assert.deepEqual(remoteRunArgv('abc', 'line', 'rr.mjs', 'mac'), [
    'rr.mjs',
    '--host',
    'mac',
    '--ref',
    'abc',
    '--slot',
    'push-suite',
    '--',
    'line',
  ]);
});

test('a remote run counts as red unless its suite says ok, and as no verdict when the suite never ran', () => {
  const planned = 'push-suite: planned lint (), coverage ()\n';
  assert.equal(remoteVerdict(0, `x\n${planned}push-suite: ok 0123abcd\n`), 0);
  assert.equal(remoteVerdict(1, `${planned}push-suite: blocked tools failed at 0123abcd\n`), 1);
  assert.equal(remoteVerdict(0, `${planned}push-suite: blocked lint failed at 0123abcd\n`), 1);
  assert.equal(
    remoteVerdict(0, 'push-suite: lint ok in 0 s (no linted project touched)\npush-suite: ok 0123abcd\n'),
    undefined,
  );
  assert.equal(remoteVerdict(255, 'ssh: connect to host rack: No route to host\n'), undefined);
  assert.equal(remoteVerdict(1, '[rack-linux] yarn install failed\n'), undefined);
  assert.match(
    remoteSuiteLine({ chosen: ['lint', 'tools'], lintProjects: [], coverageLibs: ['core'] }),
    /--only lint,tools --lint-projects= --coverage-libs=core HEAD$/,
  );
});

test('--only refuses a step outside the fast set before it takes any lock', async () => {
  const lines = [];

  assert.equal(await pushSuite({ only: 'lint,e2e', range: 'HEAD..HEAD' }, (line) => lines.push(line)), 1);
  assert.deepEqual(lines, ['push-suite: blocked unknown step e2e, expected one of lint, tools, coverage']);
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
  assert.deepEqual(reexecCommand('/e', '/r', { range: 'a..b', maxLoad: 12 }, {}).args.slice(1), [
    '--max-load',
    '12',
    'a..b',
  ]);
});

test('push-suite imports no sibling script at load time, so no live gate code runs before the re-exec', () => {
  const source = readFileSync(join(import.meta.dirname, 'push-suite.mjs'), 'utf8');

  assert.deepEqual(source.match(/^import .* from '\.\/.*';$/gm) ?? [], []);
});

test('checks export coverage only for the covered libs the range touches, all of them on a tool change', () => {
  assert.deepEqual(coverageLibs(['libs/core/src/a.ts', 'libs/cdk/b.ts', 'apps/x/c.ts']), ['core']);
  assert.deepEqual(coverageLibs(['libs/components/x.ts', 'libs/query/y.ts']), ['query', 'components']);
  assert.deepEqual(coverageLibs(['tools/export-coverage/core.allowlist.json']), COVERAGE_LIBS);
  assert.deepEqual(coverageLibs(['plans/x.md']), []);
  assert.equal(STEPS.at(-1), 'coverage');
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

const stepHarness = (loads, results) => {
  const lines = [];
  let runs = 0;
  let index = 0;
  const load = () => loads[Math.min(index++, loads.length - 1)];
  return {
    lines,
    runs: () => runs,
    options: {
      name: 'tools',
      run: async () => results[runs++],
      limit: 4,
      log: (line) => lines.push(line),
      loadProbe: {
        load,
        timers: { every: () => 1, clear: () => undefined },
        sleep: async () => undefined,
        now: () => 0,
      },
    },
  };
};

test('a step that fails under a load peak above the limit reruns once after the load drops', async () => {
  const { lines, runs, options } = stepHarness([2, 30, 30, 9, 9, 2, 2, 2, 2], [{ status: 1 }, { status: 0 }]);
  const result = await runStepUnderLoad(options);

  assert.equal(result.status, 0);
  assert.equal(runs(), 2);
  assert.deepEqual(
    lines.map((line) => line.replace(/ in \d+ s$/, '')),
    [
      'push-suite: tools failed at load 30.0 (max 30.0 during the step)',
      'push-suite: tools failed with the load above the limit 4, rerunning it once after the load drops',
      'push-suite: waiting to rerun tools, load 9.0 is above the limit 4',
      'push-suite: tools ok',
      'push-suite: tools passed on the rerun; the first run failed at a load peak of 30.0',
    ],
  );
});

test('a step that fails at a load within the limit does not rerun', async () => {
  const { runs, options } = stepHarness([2], [{ status: 1 }, { status: 0 }]);

  assert.equal((await runStepUnderLoad(options)).status, 1);
  assert.equal(runs(), 1);
});

test('a step that fails again on the rerun reports the second failure', async () => {
  const { runs, options } = stepHarness(
    [30, 30, 2],
    [
      { status: 1, output: 'first' },
      { status: 1, output: 'second' },
    ],
  );
  const result = await runStepUnderLoad(options);

  assert.deepEqual([result.status, result.output, runs()], [1, 'second', 2]);
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

const checksFixture = ({ workflow = true } = {}) => {
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
  if (!workflow) return repo;
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
      env: gitEnv({
        PUSH_SUITE_REPO: repo,
        PUSH_SUITE_MAX_LOAD: '1000',
        PUSH_SUITE_EXPORT: '',
        ETHLETE_HEAVY_LOCK_FILE: join(lockDir, 'heavy.lock'),
      }),
      timeout: 120_000,
    });
    const output = `${run.stdout}${run.stderr}`;

    assert.equal(run.status, 1, output);
    assert.match(output, /pre-push: lint:runner-os failed:/);
    assert.match(output, /Linux-only path outside a Linux branch/);
    assert.match(output, /push-suite: blocked pre-push checks failed \(lint:runner-os\)/);
    assert.doesNotMatch(output, /push-suite: (exported|lint|cli) /);
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

const rackFixture = () => {
  const repo = checksFixture({ workflow: false });
  mkdirSync(join(repo, 'libs/demo'), { recursive: true });
  writeFileSync(join(repo, 'libs/demo/project.json'), '{ "name": "demo" }\n');
  writeFileSync(join(repo, 'libs/demo/eslint.config.mjs'), 'export default [];\n');
  sh(repo, 'git', ['add', '.']);
  sh(repo, 'git', ['commit', '-q', '-m', 'demo']);
  mkdirSync(join(repo, 'libs/core'), { recursive: true });
  writeFileSync(join(repo, 'libs/core/a.ts'), 'export const a = 1;\n');
  sh(repo, 'git', ['add', '.']);
  sh(repo, 'git', ['commit', '-q', '-m', 'core']);
  writeFileSync(join(repo, 'libs/demo/b.ts'), 'export const b = 1;\n');
  sh(repo, 'git', ['add', '.']);
  sh(repo, 'git', ['commit', '-q', '-m', 'demo b']);
  return repo;
};

const runOnFakeRack = ({ out, code, sshExit = 0, machine = 'rack', lockHolder, macDown = false, rackRun }) => {
  const repo = rackFixture();
  const dir = mkdtempSync(join(tmpdir(), 'push-suite-rack-'));
  const ssh = join(dir, 'fake-ssh');
  writeFileSync(
    ssh,
    `#!/bin/sh\ncat >/dev/null\ncase "$5" in *@*) code=${sshExit} ;; *) code=${macDown ? 255 : 0} ;; esac\necho heavy-probe-ok\nexit $code\n`,
    { mode: 0o755 },
  );
  const fake = join(dir, 'remote-run.mjs');
  writeFileSync(
    fake,
    `import { appendFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const host = argv[argv.indexOf('--host') + 1];
writeFileSync(${JSON.stringify(join(dir, 'argv.json'))}, JSON.stringify(argv));
appendFileSync(${JSON.stringify(join(dir, 'hosts'))}, host + '\\n');
const { out, code } = host === 'rack' && ${JSON.stringify(rackRun ?? null)} || ${JSON.stringify({ out, code })};
console.log(out);
process.exit(code);
`,
  );
  if (lockHolder)
    writeFileSync(join(dir, 'heavy.lock'), JSON.stringify({ pid: lockHolder, name: 'studio:e2e', started: 0 }));
  try {
    const run = spawnSync(
      process.execPath,
      [join(import.meta.dirname, 'push-suite.mjs'), '--only', 'lint,coverage', 'HEAD~3..HEAD'],
      {
        encoding: 'utf8',
        env: gitEnv({
          PUSH_SUITE_REPO: repo,
          PUSH_SUITE_MAX_LOAD: '1000',
          PUSH_SUITE_EXPORT: '',
          PUSH_SUITE_MACHINE: machine,
          PUSH_SUITE_REMOTE_RUN: fake,
          HEAVY_SSH: ssh,
          ETHLETE_HEAVY_LOCK_FILE: join(dir, 'heavy.lock'),
        }),
        timeout: 120_000,
      },
    );
    let argv;
    let hosts = [];
    try {
      argv = JSON.parse(readFileSync(join(dir, 'argv.json'), 'utf8'));
      hosts = readFileSync(join(dir, 'hosts'), 'utf8').trim().split('\n');
    } catch {
      argv = undefined;
    }
    return {
      status: run.status,
      output: `${run.stdout}${run.stderr}`,
      argv,
      hosts,
      sha: sh(repo, 'git', ['rev-parse', 'HEAD']).stdout.trim(),
      base: sh(repo, 'git', ['rev-parse', 'HEAD~3']).stdout.trim(),
    };
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
};

test('on rack the suite runs the pushed commit with its planned projects, since a depth-2 checkout has no base', () => {
  const run = runOnFakeRack({
    out: 'push-suite: planned lint (demo), coverage (core)\npush-suite: ok 0123abcd',
    code: 0,
  });

  assert.equal(run.status, 0, run.output);
  assert.deepEqual(run.argv.slice(0, 9), [
    '--host',
    'rack',
    '--linux',
    '--ref',
    run.sha,
    '--slot',
    'push-suite',
    '--yarn-cache',
    '--',
  ]);
  assert.match(run.argv[9], /--only lint,coverage --lint-projects=demo --coverage-libs=core HEAD$/);
  assert.doesNotMatch(run.argv[9], new RegExp(run.base));
  assert.doesNotMatch(run.output, /push-suite: exported/);
});

test('a red suite on rack blocks the push like a red local run', () => {
  const run = runOnFakeRack({
    out: 'push-suite: planned lint (demo), coverage (core)\npush-suite: blocked lint failed at 0123abcd',
    code: 1,
  });

  assert.equal(run.status, 1, run.output);
  assert.match(run.output, /push-suite: rack run failed/);
  assert.doesNotMatch(run.output, /push-suite: exported/);
});

test('a rack run without a verdict and an unreachable rack both fall back to tank', () => {
  const broken = runOnFakeRack({ out: 'ssh: connect to host rack: No route to host', code: 255 });
  assert.match(broken.output, /rack run ended without a verdict \(exit 255\)/);
  assert.match(broken.output, /no remote machine gave a verdict, running on tank/);
  assert.match(broken.output, /push-suite: exported/);

  const down = runOnFakeRack({ out: 'unused', code: 0, sshExit: 255 });
  assert.equal(down.argv, undefined);
  assert.match(down.output, /rack does not answer, skipping it/);
  assert.match(down.output, /push-suite: exported/);
});

test('without --on the suite goes to rack instead of waiting while another heavy run holds tank', () => {
  const run = runOnFakeRack({
    out: 'push-suite: planned lint (demo), coverage (core)\npush-suite: ok 0123abcd',
    code: 0,
    machine: '',
    lockHolder: process.pid,
  });

  assert.equal(run.status, 0, run.output);
  assert.equal(run.argv[4], run.sha);
  assert.doesNotMatch(run.output, /heavy run lock held/);
});

test('while tank is busy an unusable rack or a rack run without a verdict sends the suite to mac', () => {
  const ok = { out: 'push-suite: planned lint (demo), coverage (core)\npush-suite: ok 0123abcd', code: 0 };
  const down = runOnFakeRack({ ...ok, sshExit: 255, machine: '', lockHolder: process.pid });
  assert.equal(down.status, 0, down.output);
  assert.deepEqual(down.hosts, ['mac']);
  assert.deepEqual(down.argv.slice(0, 7), ['--host', 'mac', '--ref', down.sha, '--slot', 'push-suite', '--']);
  assert.match(down.output, /rack does not answer, skipping it/);
  assert.match(down.output, /push-suite: mac run ok/);

  const broken = runOnFakeRack({
    ...ok,
    machine: '',
    lockHolder: process.pid,
    rackRun: { out: 'wsl: exit 127', code: 199 },
  });
  assert.equal(broken.status, 0, broken.output);
  assert.deepEqual(broken.hosts, ['rack', 'mac']);
  assert.match(broken.output, /rack run ended without a verdict \(exit 199\)/);
  assert.doesNotMatch(broken.output, /push-suite: exported/);
});
