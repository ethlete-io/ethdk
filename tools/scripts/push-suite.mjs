#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const INNER_EXPORT = process.env['PUSH_SUITE_EXPORT'];
const root = process.env['PUSH_SUITE_REPO'] ?? resolve(import.meta.dirname, '../..');
const WORKSPACE_PARENTS = ['apps', 'libs', 'tools'];

export const STEPS = ['lint', 'tools', 'coverage'];
export const COVERAGE_LIBS = ['query', 'core', 'components'];

const VALUE_FLAGS = ['--only', '--max-load', '--on'];

const listFlag = (argv, flag) => {
  const arg = argv.find((candidate) => candidate.startsWith(`${flag}=`));
  return arg === undefined
    ? undefined
    : arg
        .slice(flag.length + 1)
        .split(',')
        .filter(Boolean);
};

export const parseArgs = (argv) => {
  const valueOf = (flag) => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const maxLoad = valueOf('--max-load');
  const on = valueOf('--on');
  const lintProjects = listFlag(argv, '--lint-projects');
  const coverage = listFlag(argv, '--coverage-libs');
  const range = argv.find((arg, index) => !arg.startsWith('--') && !VALUE_FLAGS.includes(argv[index - 1]));

  return {
    only: valueOf('--only'),
    range: range ?? '@{upstream}..HEAD',
    ...(maxLoad === undefined ? {} : { maxLoad: Number(maxLoad) }),
    ...(on === undefined ? {} : { on }),
    ...(lintProjects === undefined ? {} : { lintProjects }),
    ...(coverage === undefined ? {} : { coverageLibs: coverage }),
  };
};

export const LOAD_SAMPLE_MS = 5_000;
export const LOAD_POLL_MS = 15_000;
export const LOAD_MAX_WAIT_MS = 10 * 60_000;

const oneMinuteLoad = () => loadavg()[0];
const formatLoad = (load) => load.toFixed(1);

export const sampleMaxLoad = (load = oneMinuteLoad, { every = setInterval, clear = clearInterval } = {}) => {
  let max = load();
  const timer = every(() => {
    max = Math.max(max, load());
  }, LOAD_SAMPLE_MS);
  return () => {
    clear(timer);
    return Math.max(max, load());
  };
};

export const loadLimitOf = (maxLoad, env = process.env) =>
  maxLoad ?? Number(env['PUSH_SUITE_MAX_LOAD'] || cpus().length);

export const waitForLowLoad = async (
  {
    limit,
    log,
    load = oneMinuteLoad,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
    now = Date.now,
    action = 'start',
    acting = 'starting',
  },
  { pollMs = LOAD_POLL_MS, maxWaitMs = LOAD_MAX_WAIT_MS } = {},
) => {
  const startedAt = now();
  while (load() > limit) {
    if (now() - startedAt >= maxWaitMs) {
      log(
        `push-suite: ${acting} under load ${formatLoad(load())} (limit ${limit}) after ${seconds(maxWaitMs)} of waiting`,
      );
      return;
    }
    log(`push-suite: waiting to ${action}, load ${formatLoad(load())} is above the limit ${limit}`);
    await sleep(pollMs);
  }
};

const FAILED_ROW = /^\s*(✘\s|\d+\) \[|NOT RUN |HOLD FAIL |FAIL\s)/;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const stripAnsi = (line) => line.replace(ANSI, '');

export const failureReport = (output) => {
  const lines = output.split('\n');
  const tail = lines.slice(-40);
  const failed = lines.slice(0, -40).filter((line) => FAILED_ROW.test(stripAnsi(line)));

  return [...failed, ...tail].join('\n');
};

export const lintedProjects = (files, read = (path) => readFileSync(path, 'utf8'), exists = existsSync) => {
  const names = new Set();
  for (const file of files) {
    const [parent, name] = file.split('/');
    if (!WORKSPACE_PARENTS.includes(parent)) continue;
    const dir = join(root, parent, name);
    if (exists(join(dir, 'eslint.config.mjs')) && exists(join(dir, 'project.json')))
      names.add(JSON.parse(read(join(dir, 'project.json'))).name);
  }
  return [...names].sort();
};

export const lintStep = (projects, dir) =>
  projects.length === 0
    ? Promise.resolve({ status: 0, output: '', note: 'no linted project touched' })
    : runStep('npx', ['nx', 'run-many', '-t', 'lint', '-p', ...projects], dir);

export const coverageLibs = (files) =>
  files.some((file) => file.startsWith('tools/export-coverage/'))
    ? COVERAGE_LIBS
    : COVERAGE_LIBS.filter((lib) => files.some((file) => file.startsWith(`libs/${lib}/`)));

export const coverageStep = async (libs, dir) => {
  if (libs.length === 0) return { status: 0, output: '', note: 'no covered lib touched' };
  for (const lib of libs) {
    const run = await runStep('node', ['tools/export-coverage/check.mjs', lib], dir);
    if (run.status !== 0) return run;
  }
  return { status: 0, output: '', note: libs.join(', ') };
};

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

const seconds = (ms) => `${(ms / 1000).toFixed(0)} s`;

export const preChecksStep = async (range) => {
  const [from, to = 'HEAD'] = range.split('..');
  const [base, head] = [from, to].map((rev) => git('rev-parse', rev));
  if (base.status !== 0 || head.status !== 0)
    return { status: 1, output: (base.stderr || head.stderr).trim(), names: ['range'] };
  const lines = [];
  const format = spawnSync(
    process.execPath,
    [join(root, '.husky/format-check-committed.mjs'), base.stdout.trim(), head.stdout.trim()],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  if (format.status !== 0) lines.push('pre-push: format check failed:', `${format.stdout}${format.stderr}`.trim());
  const { scopeSelfLinks, scopeSelfLinksMessage } = await import('./commit-export.mjs');
  const selfLinks = scopeSelfLinks(root);
  if (selfLinks.length) lines.push(scopeSelfLinksMessage(selfLinks));
  const { runChecks } = await import('./pre-push-checks.mjs');
  const failed = runChecks(base.stdout.trim(), head.stdout.trim(), { cwd: root, log: (line) => lines.push(line) });
  const names = [
    ...(format.status === 0 ? [] : ['format']),
    ...(selfLinks.length ? ['node_modules-self-links'] : []),
    ...failed.map((item) => item.check),
  ];
  return { status: names.length ? 1 : 0, output: lines.join('\n'), names };
};

export const withStepTmp = async (name, run, env = process.env) => {
  const { leakMessageOf, openSpecTmp } = await import('./spec-tmp.mjs');
  const previous = env['TMPDIR'];
  const tmp = openSpecTmp(previous || tmpdir());
  let result;
  let left;

  env['TMPDIR'] = tmp.dir;
  try {
    result = await run();
  } finally {
    if (previous === undefined) delete env['TMPDIR'];
    else env['TMPDIR'] = previous;
    left = tmp.close();
  }
  if (left.length === 0) return result;
  return { ...result, note: [result.note, leakMessageOf(`push-suite step ${name}`, left)].filter(Boolean).join('; ') };
};

export const stepLine = (name, status, ms, note, load, max = load) =>
  `push-suite: ${name} ${status === 0 ? 'ok' : `failed at load ${formatLoad(load)} (max ${formatLoad(max)} during the step)`} in ${seconds(ms)}${note ? ` (${note})` : ''}`;

export const runStep = async (command, args, cwd, env = {}) => {
  const { registerRun } = await import('./run-registry.mjs');
  return new Promise((done) => {
    const line = [command, ...args].join(' ');
    const run = registerRun({ label: `push-suite ${line}`, command: line, cwd });
    const log = createWriteStream(run.log, { flags: 'a' });
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const take = (chunk) => {
      output += chunk;
      log.write(chunk);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (status) =>
      log.end(() => {
        run.finish(status ?? 1);
        done({ status: status ?? 1, output });
      }),
    );
  });
};

export const reexecCommand = (exportDir, repo, { only, range, maxLoad }, env = process.env) => ({
  command: process.execPath,
  args: [
    join(exportDir, 'tools/scripts/push-suite.mjs'),
    ...(only ? ['--only', only] : []),
    ...(maxLoad === undefined ? [] : ['--max-load', String(maxLoad)]),
    range,
  ],
  env: { ...env, PUSH_SUITE_REPO: repo, PUSH_SUITE_EXPORT: exportDir },
});

/**
 * The machine the steps run on: `on` (flag `--on` or env `PUSH_SUITE_MACHINE`) wins, else tank while it is free and
 * rack while it is not. rack falls back to tank when it does not answer.
 */
export const pushSuiteMachine = ({ on, tankIsFree, rackIsUp, log }) => {
  if ((on ?? (tankIsFree() ? 'tank' : 'rack')) === 'tank') return 'tank';
  if (rackIsUp()) return 'rack';
  log('push-suite: rack does not answer, running on tank');
  return 'tank';
};

/** The suite line for a remote checkout: it carries the planned projects, since a shallow checkout has no range base. */
export const remoteSuiteLine = ({ chosen, lintProjects, coverageLibs }) =>
  [
    'PUSH_SUITE_EXPORT="$PWD" node tools/scripts/push-suite.mjs --only',
    chosen.join(','),
    `--lint-projects=${lintProjects.join(',')}`,
    `--coverage-libs=${coverageLibs.join(',')}`,
    'HEAD',
  ].join(' ');

export const remoteRunArgv = (sha, line, script) => [
  script,
  '--host',
  'rack',
  '--linux',
  '--ref',
  sha,
  '--slot',
  'push-suite',
  '--yarn-cache',
  '--',
  line,
];

export const plannedLine = (lintProjects, coverage) =>
  `push-suite: planned lint (${lintProjects?.join(', ') ?? 'from the range'}), coverage (${coverage?.join(', ') ?? 'from the range'})`;

/**
 * The exit code of a remote run, or undefined when it ended without a suite verdict (ssh, docker, install) or the
 * commit's push-suite ignored the planned projects.
 */
export const remoteVerdict = (code, output) => {
  if (!/^push-suite: planned /m.test(output) || !/^push-suite: (ok|blocked) /m.test(output)) return undefined;
  return code === 0 && /^push-suite: ok [0-9a-f]+/m.test(output) ? 0 : code || 1;
};

const heavyRunHeld = (holder) => {
  if (!holder) return false;
  try {
    process.kill(holder.pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const runRemote = (argv, cwd) =>
  new Promise((done) => {
    const child = spawn(process.execPath, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const forward = (signal) => child.kill(signal);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, forward);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', (error) => (output += error.message));
    child.on('close', (code) => {
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.off(signal, forward);
      done({ code: code ?? 1, output });
    });
  });

/** Runs a step; when it fails with a load peak above `limit`, waits for the load to drop and runs it once more. */
export const runStepUnderLoad = async ({ name, run, limit, log, loadProbe = {}, waitOptions }) => {
  const attempt = async () => {
    const startedAt = performance.now();
    const stopSampling = sampleMaxLoad(loadProbe.load, loadProbe.timers);
    const result = await run();
    const max = stopSampling();
    log(
      stepLine(
        name,
        result.status,
        performance.now() - startedAt,
        result.note,
        (loadProbe.load ?? oneMinuteLoad)(),
        max,
      ),
    );
    return { ...result, max };
  };
  const first = await attempt();
  if (first.status === 0 || first.max <= limit) return first;

  log(`push-suite: ${name} failed with the load above the limit ${limit}, rerunning it once after the load drops`);
  await waitForLowLoad({ limit, log, ...loadProbe, action: `rerun ${name}`, acting: `rerunning ${name}` }, waitOptions);
  const second = await attempt();
  if (second.status === 0)
    log(`push-suite: ${name} passed on the rerun; the first run failed at a load peak of ${formatLoad(first.max)}`);
  return second;
};

const runInner = (plan) =>
  new Promise((done) => {
    const child = spawn(plan.command, plan.args, { env: plan.env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => child.kill(signal));
    child.on('close', (status) => done(status ?? 1));
  });

export const warnStaleDesignServers = async (log) => {
  const { staleDesignServers, staleServerWarnings } = await import('./stale-design-servers.mjs');
  const ps = spawnSync('ps', ['-Ao', 'pid,etime,command'], { encoding: 'utf8' });
  if (ps.status !== 0) return;
  for (const line of staleServerWarnings(staleDesignServers(ps.stdout, { root }))) log(line);
};

const TEST_OR_BUILD_WORK =
  /(^|[\s/])(tsc|vitest|jest|playwright|nx|ng|vite|webpack|esbuild|cargo|rustc|storybook)([\s/.]|$)|ms-playwright|chrome-headless-shell|design (check|task)/;
const LONG_LIVED = /nx\/dist\/src\/daemon|design __resident|--lsp|--node-ipc|--type=/;

const relatives = (processes, pid, next) => {
  const found = new Set([pid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const candidate of processes) {
      if (found.has(candidate.pid) || !found.has(next(candidate))) continue;
      found.add(candidate.pid);
      grew = true;
    }
  }
  return found;
};

/**
 * The processes of this checkout that look like test or build work: not this process, its ancestors or descendants,
 * not a long-lived server (the Nx daemon, a language server, the design resident) or what it started. A process whose
 * checkout is unknown never matches. Only the first three words of a command are judged, so a prompt in its arguments
 * never matches.
 */
export const otherTestProcessesOf = ({ processes, root: checkout, selfPid }) => {
  const byPid = new Map(processes.map((candidate) => [candidate.pid, candidate]));
  const own = relatives(processes, selfPid, (candidate) => candidate.ppid);
  for (let pid = byPid.get(selfPid)?.ppid; pid && byPid.has(pid); pid = byPid.get(pid).ppid) own.add(pid);
  const longLived = new Set();
  for (const server of processes.filter((candidate) => LONG_LIVED.test(candidate.args))) {
    for (const pid of relatives(processes, server.pid, (child) => child.ppid)) longLived.add(pid);
  }

  return processes.filter(
    ({ pid, args, cwd }) =>
      cwd !== null &&
      (cwd === checkout || cwd.startsWith(checkout + sep)) &&
      !own.has(pid) &&
      !longLived.has(pid) &&
      TEST_OR_BUILD_WORK.test(args.split(' ').slice(0, 3).join(' ')),
  );
};

export const otherProcessWarningLines = (found, checkout) => [
  `push-suite: warning: ${found.length} other test or build process(es) of this checkout run:`,
  ...found.map(({ pid, cpu, args }) => {
    const command = args
      .split(' ')
      .map((token) =>
        token.startsWith(checkout + sep) ? relative(checkout, token) : token.startsWith('/') ? basename(token) : token,
      )
      .join(' ');

    return `  ${pid}  ${cpu.toFixed(1).padStart(5)} % cpu  ${command.slice(0, 100)}`;
  }),
];

const warnAboutOtherProcesses = async (log) => {
  const { processList } = await import('../../apps/ethlete-studio/e2e/run-load.mjs');
  const processes = processList();
  if (processes.length > 0 && processes.every(({ cwd }) => cwd === null)) {
    log('push-suite: other processes of this checkout not checked: no /proc on this OS');
    return;
  }
  const found = otherTestProcessesOf({ processes, root, selfPid: process.pid });
  if (found.length > 0) for (const line of otherProcessWarningLines(found, root)) log(line);
};

export const pushSuite = async (
  { only, range, maxLoad, on = process.env['PUSH_SUITE_MACHINE'] || undefined, lintProjects, coverageLibs: coverage },
  log = console.log,
  loadProbe = {},
) => {
  const sha = git('rev-parse', range.split('..')[1] || 'HEAD').stdout.trim();
  const chosen = only ? only.split(',') : STEPS;
  let slot;
  let heavyLock;
  const release = () => {
    heavyLock?.release();
    heavyLock = undefined;
    if (!slot) return;
    const released = slot.releaseSlot({ cwd: root });
    slot = undefined;
    log(released.ok ? 'push-suite: push slot released' : `push-suite: push slot not released: ${released.reason}`);
  };
  const finish = (outcome) => {
    log(`push-suite: ${outcome}`);
    if (outcome.startsWith('ok')) {
      heavyLock?.release();
      heavyLock = undefined;
    } else release();
    return outcome.startsWith('ok') ? 0 : 1;
  };

  const unknown = chosen.find((step) => !STEPS.includes(step));
  if (unknown) return finish(`blocked unknown step ${unknown}, expected one of ${STEPS.join(', ')}`);

  if (!INNER_EXPORT && !only) {
    await warnAboutOtherProcesses(log);
    const { claimSlot, heldLine, releaseSlot } = await import('./push-slot.mjs');
    const claim = claimSlot({ cwd: root, sha });
    if (claim.ok) {
      slot = { releaseSlot };
      log(`push-suite: ${heldLine(claim.slot)}`);
    } else if (claim.slot) return finish(`blocked ${heldLine(claim.slot)}; commit on, push after its push or expiry`);
    else if (claim.lost)
      return finish('blocked another builder claimed the push slot first; see `yarn push:slot status`');
    else log(`push-suite: push slot not claimed, running anyway: ${claim.reason}`);
  }

  if (!INNER_EXPORT) {
    const startedAt = performance.now();
    const checks = await preChecksStep(range);
    if (checks.status !== 0) {
      log(checks.output);
      return finish(`blocked pre-push checks failed (${checks.names.join(', ')}) at ${sha}`);
    }
    log(`push-suite: checks ok in ${seconds(performance.now() - startedAt)}`);
  }

  const changed = () => {
    const run = git('diff', '--name-only', range);
    return run.status === 0
      ? { files: run.stdout.split('\n').filter(Boolean) }
      : { error: run.stderr || 'git diff failed' };
  };

  if (!INNER_EXPORT) {
    if (on !== undefined && !['tank', 'rack'].includes(on))
      return finish(`blocked unknown machine ${on}, expected tank or rack`);
    const { machineIsUp, tankHasFreeSlot } = await import('./heavy-route.mjs');
    const { holderLine, readHolder, takeHeavyLock } = await import('./heavy-run-lock.mjs');
    const limit = loadLimitOf(maxLoad);
    const machine = pushSuiteMachine({
      on,
      tankIsFree: () =>
        !heavyRunHeld(readHolder()) && tankHasFreeSlot() && (loadProbe.load ?? oneMinuteLoad)() <= limit,
      rackIsUp: () => machineIsUp('rack'),
      log,
    });
    if (machine === 'rack') {
      const { files, error: diffError } = changed();
      if (diffError !== undefined) return finish(`blocked git diff ${range} failed: ${diffError.trim()}`);
      const line = remoteSuiteLine({ chosen, lintProjects: lintedProjects(files), coverageLibs: coverageLibs(files) });
      const script = process.env['PUSH_SUITE_REMOTE_RUN'] ?? join(import.meta.dirname, 'remote-run.mjs');
      log(`push-suite: running ${chosen.join(', ')} of ${sha.slice(0, 12)} on rack`);
      const startedAt = performance.now();
      const { code, output } = await runRemote(remoteRunArgv(sha, line, script), root);
      const status = remoteVerdict(code, output);
      if (status !== undefined) {
        log(`push-suite: rack run ${status === 0 ? 'ok' : 'failed'} in ${seconds(performance.now() - startedAt)}`);
        if (status !== 0) release();
        return status;
      }
      log(`push-suite: rack run ended without a verdict (exit ${code}), running on tank`);
    }
    const lock = await takeHeavyLock('push-suite', { log });
    if (!lock.ok) return finish(`blocked ${holderLine(lock.holder)}`);
    heavyLock = lock;
    await waitForLowLoad({ limit, log, ...loadProbe });
  }

  Object.assign(process.env, { NX_NO_CLOUD: 'true', NX_DAEMON: 'false' });
  delete process.env['STUDIO_CLI_ENTRY'];
  const exportedAt = performance.now();
  const { exportCommit, toolsStepEnv } = await import('./commit-export.mjs');
  const { dir, error } = INNER_EXPORT ? { dir: INNER_EXPORT } : exportCommit(root, sha);
  const removeExport = () => (INNER_EXPORT ? undefined : rmSync(dir, { recursive: true, force: true }));
  if (!INNER_EXPORT)
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
      process.once(signal, () => {
        release();
        removeExport();
        process.exit(1);
      });

  const steps = {
    lint: () => {
      if (lintProjects) return lintStep(lintProjects, dir);
      const { files, error: diffError } = changed();
      return diffError === undefined
        ? lintStep(lintedProjects(files), dir)
        : Promise.resolve({ status: 1, output: diffError });
    },
    tools: () => runStep('yarn', ['test:tools'], dir, toolsStepEnv(root)),
    coverage: () => {
      if (coverage) return coverageStep(coverage, dir);
      const { files, error: diffError } = changed();
      return diffError === undefined
        ? coverageStep(coverageLibs(files), dir)
        : Promise.resolve({ status: 1, output: diffError });
    },
  };

  try {
    if (error) return finish(`blocked export of ${sha} failed: ${error}`);
    if (!INNER_EXPORT) {
      log(`push-suite: exported ${sha.slice(0, 12)} to ${dir} in ${seconds(performance.now() - exportedAt)}`);
      const status = await runInner(reexecCommand(dir, root, { only, range, maxLoad }));
      if (status !== 0) release();
      else heavyLock?.release();
      return status;
    }
    await warnStaleDesignServers(log);
    if (lintProjects || coverage) log(plannedLine(lintProjects, coverage));
    for (const name of chosen) {
      const { status, output } = await runStepUnderLoad({
        name,
        run: () => withStepTmp(name, steps[name]),
        limit: loadLimitOf(maxLoad),
        log,
        loadProbe,
      });
      if (status !== 0) {
        log(failureReport(output));
        return finish(`blocked ${name} failed at ${sha}`);
      }
    }
    return finish(`ok ${sha}`);
  } finally {
    removeExport();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (!INNER_EXPORT) (await import('./own-scope.mjs')).enterOwnScope('push-suite');
  process.exit(await pushSuite(parseArgs(process.argv.slice(2))));
}
