#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const INNER_EXPORT = process.env['PUSH_SUITE_EXPORT'];
const root = process.env['PUSH_SUITE_REPO'] ?? resolve(import.meta.dirname, '../..');
const WORKSPACE_PARENTS = ['apps', 'libs', 'tools'];

export const STEPS = ['lint', 'typecheck', 'tools'];

export const parseArgs = (argv) => {
  const at = argv.indexOf('--only');
  const only = at === -1 ? undefined : argv[at + 1];
  const loadAt = argv.indexOf('--max-load');
  const maxLoad = loadAt === -1 ? undefined : Number(argv[loadAt + 1]);
  const range = argv.find(
    (arg, index) => !arg.startsWith('--') && (at === -1 || index !== at + 1) && (loadAt === -1 || index !== loadAt + 1),
  );

  return { only, range: range ?? '@{upstream}..HEAD', ...(maxLoad === undefined ? {} : { maxLoad }) };
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

export const waitForLowLoad = async (
  { limit, log, load = oneMinuteLoad, sleep = (ms) => new Promise((done) => setTimeout(done, ms)), now = Date.now },
  { pollMs = LOAD_POLL_MS, maxWaitMs = LOAD_MAX_WAIT_MS } = {},
) => {
  const startedAt = now();
  while (load() > limit) {
    if (now() - startedAt >= maxWaitMs) {
      log(
        `push-suite: starting under load ${formatLoad(load())} (limit ${limit}) after ${seconds(maxWaitMs)} of waiting`,
      );
      return;
    }
    log(`push-suite: waiting to start, load ${formatLoad(load())} is above the limit ${limit}`);
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

export const touchedProjects = (files, read = (path) => readFileSync(path, 'utf8'), exists = existsSync) => {
  const names = new Set();
  for (const file of files) {
    const [parent, name] = file.split('/');
    if (!WORKSPACE_PARENTS.includes(parent) || name === undefined) continue;
    const projectFile = join(root, parent, name, 'project.json');
    if (exists(projectFile)) names.add(JSON.parse(read(projectFile)).name);
  }
  return [...names].sort();
};

export const withTarget = (projects, available) => projects.filter((name) => available.includes(name));

export const typecheckStep = async (projects, dir) => {
  if (projects.length === 0) return { status: 0, output: '', note: 'no project touched' };
  const listed = await runStep('npx', ['nx', 'show', 'projects', '--with-target', 'typecheck', '--json'], dir);
  if (listed.status !== 0) return listed;
  const checked = withTarget(projects, JSON.parse(listed.output.slice(listed.output.indexOf('['))));
  if (checked.length === 0) return { status: 0, output: '', note: 'no touched project has a typecheck target' };
  const run = await runStep('npx', ['nx', 'run-many', '-t', 'typecheck', '-p', ...checked], dir);
  return { ...run, note: checked.join(', ') };
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

export const runStep = (command, args, cwd, env = {}) =>
  new Promise((done) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const take = (chunk) => {
      output += chunk;
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (status) => done({ status: status ?? 1, output }));
  });

export const reexecCommand = (exportDir, repo, { only, range }, env = process.env) => ({
  command: process.execPath,
  args: [join(exportDir, 'tools/scripts/push-suite.mjs'), ...(only ? ['--only', only] : []), range],
  env: { ...env, PUSH_SUITE_REPO: repo, PUSH_SUITE_EXPORT: exportDir },
});

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

export const pushSuite = async ({ only, range, maxLoad }, log = console.log, loadProbe = {}) => {
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

  if (!INNER_EXPORT) {
    const { holderLine, takeHeavyLock } = await import('./heavy-run-lock.mjs');
    const lock = await takeHeavyLock('push-suite', { log });
    if (!lock.ok) return finish(`blocked ${holderLine(lock.holder)}`);
    heavyLock = lock;
  }

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

  if (!INNER_EXPORT) {
    const limit = maxLoad ?? Number(process.env['PUSH_SUITE_MAX_LOAD'] || cpus().length);
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
      const changed = git('diff', '--name-only', range);
      if (changed.status !== 0) return Promise.resolve({ status: 1, output: changed.stderr });
      return lintStep(lintedProjects(changed.stdout.split('\n').filter(Boolean)), dir);
    },
    typecheck: () => {
      const changed = git('diff', '--name-only', range);
      if (changed.status !== 0) return Promise.resolve({ status: 1, output: changed.stderr });
      return typecheckStep(touchedProjects(changed.stdout.split('\n').filter(Boolean)), dir);
    },
    tools: () => runStep('yarn', ['test:tools'], dir, toolsStepEnv(root)),
  };

  try {
    if (error) return finish(`blocked export of ${sha} failed: ${error}`);
    if (!INNER_EXPORT) {
      log(`push-suite: exported ${sha.slice(0, 12)} to ${dir} in ${seconds(performance.now() - exportedAt)}`);
      const status = await runInner(reexecCommand(dir, root, { only, range }));
      if (status !== 0) release();
      else heavyLock?.release();
      return status;
    }
    await warnStaleDesignServers(log);
    for (const name of chosen) {
      const startedAt = performance.now();
      const stopSampling = sampleMaxLoad(loadProbe.load, loadProbe.timers);
      const { status, output, note } = await withStepTmp(name, steps[name]);
      const maxLoad = stopSampling();
      log(stepLine(name, status, performance.now() - startedAt, note, (loadProbe.load ?? oneMinuteLoad)(), maxLoad));
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
  process.exit(await pushSuite(parseArgs(process.argv.slice(2))));
}
