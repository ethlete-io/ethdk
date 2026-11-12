#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, loadavg, platform, tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const INNER_EXPORT = process.env['PUSH_SUITE_EXPORT'];
const root = process.env['PUSH_SUITE_REPO'] ?? resolve(import.meta.dirname, '../..');
export const E2E_LOG = join(root, '.claude/handoffs/push-suite-e2e.log');
export const E2E_LOAD_LOG = join(root, '.claude/handoffs/push-suite-e2e-load.log');
export const REPEAT_LOG = join(root, '.claude/handoffs/push-suite-repeat.log');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';
const WORKSPACE_PARENTS = ['apps', 'libs', 'tools'];

export const STEPS = [
  'lint',
  'typecheck',
  'tools',
  'cli',
  'studio',
  'quota',
  'e2e',
  'e2e-quota',
  'e2e-load',
  'first-listing',
  'repeat',
];

const DESIGN_INPUTS = [
  ...['bracket', 'cli', 'components', 'core', 'eslint-plugin', 'query', 'types'].map((lib) => `libs/${lib}/`),
  'apps/ethlete-studio/',
  'apps/timetrack/',
  '.ethlete/',
];
/**
 * Path prefixes each step reads. A merged path outside every prefix (root configs, yarn.lock, tools/) reruns all
 * steps; the lib list is the import closure of libs/cli and apps/ethlete-studio, kept by hand.
 */
export const STEP_INPUTS = {
  lint: ['apps/', 'libs/'],
  typecheck: ['apps/', 'libs/'],
  tools: [],
  cli: DESIGN_INPUTS,
  studio: DESIGN_INPUTS,
  quota: DESIGN_INPUTS,
  e2e: DESIGN_INPUTS,
  'e2e-quota': DESIGN_INPUTS,
  'e2e-load': DESIGN_INPUTS,
  'first-listing': DESIGN_INPUTS,
  repeat: DESIGN_INPUTS,
};
const INERT_PATHS = [/^plans\//, /^\.changeset\//];

export const stepsTouchedBy = (files) => {
  const touched = new Set();
  for (const file of files) {
    if (INERT_PATHS.some((path) => path.test(file))) continue;
    touched.add('tools');
    const steps = STEPS.filter((step) => STEP_INPUTS[step].some((prefix) => file.startsWith(prefix)));
    if (steps.length === 0 && !file.endsWith('.md')) return new Set(STEPS);
    for (const step of steps) touched.add(step);
  }
  return touched;
};

export const passedSteps = (verdict, sha) => {
  const [head = '', ...rest] = verdict.split('\n');
  const passed = new Map();
  for (const line of rest) {
    const match = /^step (\S+) ok (\S+)$/.exec(line);
    if (match && STEPS.includes(match[1])) passed.set(match[1], match[2]);
  }
  if (head.startsWith('ok ') && passed.size === 0) for (const step of STEPS) passed.set(step, sha);
  return passed;
};

export const verdictText = (verdict, passed) =>
  [verdict, ...[...passed].map(([step, from]) => `step ${step} ok ${from}`)].join('\n') + '\n';

export const reusableSteps = (parents, readVerdict, changedSince) => {
  if (parents.length !== 2) return new Map();
  const [first] = parents;
  const verdict = readVerdict(first);
  if (verdict === undefined) return new Map();
  const changed = changedSince(first);
  if (changed === undefined) return new Map();
  const touched = stepsTouchedBy(changed);
  return new Map([...passedSteps(verdict, first)].filter(([step]) => !touched.has(step)));
};

export const reusedLine = (name, from) =>
  `push-suite: ${name} reused from ${from.slice(0, 12)} (the merge changes none of its inputs)`;

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

const STUDIO_ROOT = 'apps/ethlete-studio';
export const QUOTA_PERCENT = 20;
export const QUOTA_PERCENT_DARWIN = 10;
export const QUOTA_BUDGET_MS = 180_000;

export const quotaSpecFiles = (files) =>
  files.filter((file) => file.startsWith(`${STUDIO_ROOT}/`) && file.endsWith('.spec.ts')).sort();

const quotaVitest = (file) => [
  'npx',
  'vitest',
  'run',
  '--root',
  STUDIO_ROOT,
  '--maxWorkers=1',
  relative(STUDIO_ROOT, file),
];

export const quotaCommand = (file, quota = QUOTA_PERCENT, os = platform()) =>
  os === 'darwin'
    ? { command: 'node', args: ['tools/scripts/cpu-throttle.mjs', String(quota), '--', ...quotaVitest(file)] }
    : {
        command: 'systemd-run',
        args: ['--user', '--scope', '--quiet', '-p', `CPUQuota=${quota}%`, ...quotaVitest(file)],
      };

export const quotaLabel = (quota, os = platform()) =>
  os === 'darwin' ? `cpu-throttle ${quota}%` : `CPUQuota=${quota}%`;

const canSystemdQuota = () => spawnSync('systemd-run', ['--user', '--scope', '--quiet', 'true']).status === 0;
const canQuota = (os = platform()) => os === 'darwin' || canSystemdQuota();

export const quotaStep = async (
  files,
  {
    run,
    os = platform(),
    quota = os === 'darwin' ? QUOTA_PERCENT_DARWIN : QUOTA_PERCENT,
    budgetMs = QUOTA_BUDGET_MS,
    available = () => canQuota(os),
    now = () => performance.now(),
  },
) => {
  if (files.length === 0) return { status: 0, output: '', note: 'no changed Studio spec file' };
  if (!available())
    return {
      status: 0,
      output: '',
      note: `skipped on ${os}: the CPU quota needs systemd-run --user on Linux or cpu-throttle on darwin, so a load-sensitive Studio case is not caught here`,
    };
  return runUnderQuota(files, (file) => quotaCommand(file, quota, os), { run, quota, budgetMs, now, os });
};

const runUnderQuota = async (items, commandOf, { run, quota, budgetMs, now, os = 'linux' }) => {
  const startedAt = now();
  const ran = [];
  for (const [index, item] of items.entries()) {
    if (now() - startedAt >= budgetMs) {
      const skipped = items.slice(index);
      return {
        status: 0,
        output: '',
        note: `${quotaLabel(quota, os)}, ran ${ran.join(', ')}; over the ${seconds(budgetMs)} budget, skipped ${skipped.join(', ')}`,
      };
    }
    const { command, args } = commandOf(item);
    const result = await run(command, args);
    ran.push(item);
    if (result.status !== 0) return { ...result, note: `${quotaLabel(quota, os)}, failed ${item}` };
  }
  return { status: 0, output: '', note: `${quotaLabel(quota, os)}, ran ${ran.join(', ')}` };
};

export const E2E_QUOTA_PERCENT = 50;
export const E2E_QUOTA_BUDGET_MS = 300_000;

export const e2eQuotaCommand = (name, built, quota = E2E_QUOTA_PERCENT) => ({
  command: 'systemd-run',
  args: [
    '--user',
    '--scope',
    '--quiet',
    '-p',
    `CPUQuota=${quota}%`,
    process.execPath,
    RUNNER,
    '--built',
    built,
    '--no-timings',
    '--workers',
    '1',
    '--case',
    name,
  ],
});

export const e2eQuotaStep = async (
  { all, cases, reasons },
  {
    run,
    build,
    built,
    quota = E2E_QUOTA_PERCENT,
    budgetMs = E2E_QUOTA_BUDGET_MS,
    available = canSystemdQuota,
    now = () => performance.now(),
    os = platform(),
  },
) => {
  if (all)
    return {
      status: 0,
      output: '',
      note: `no case run under the quota: ${reasons.join('; ')}, and it runs changed cases only`,
    };
  if (cases.length === 0) return { status: 0, output: '', note: 'no changed e2e case' };
  if (!available())
    return {
      status: 0,
      output: '',
      note: `skipped on ${os}: the CPU quota needs systemd-run --user, so a load-sensitive e2e case is not caught here`,
    };
  const studio = await build();
  if (studio.status !== 0) return { ...studio, note: 'the Studio build for the quota run failed' };
  return runUnderQuota(cases, (name) => e2eQuotaCommand(name, built, quota), { run, quota, budgetMs, now });
};

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

export const verdictFileOf = (sha) =>
  join(resolve(root, git('rev-parse', '--git-path', 'push-suite').stdout.trim()), sha);

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
  return {
    ...result,
    status: result.status || 1,
    output: `${result.output}\n${leakMessageOf(`push-suite step ${name}`, left)}`,
  };
};

export const stepLine = (name, status, ms, note, load, max = load) =>
  `push-suite: ${name} ${status === 0 ? 'ok' : `failed at load ${formatLoad(load)} (max ${formatLoad(max)} during the step)`} in ${seconds(ms)}${note ? ` (${note})` : ''}`;

export const runStep = async (command, args, cwd, logFile, env = {}) => {
  const runLog = logFile ? (await import('./run-log.mjs')).startRunLog(logFile) : undefined;

  return new Promise((done) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const take = (chunk) => {
      output += chunk;
      if (runLog) appendFileSync(runLog, chunk);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (status) => done({ status: status ?? 1, output }));
  });
};

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
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  const passed = new Map();
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
  const finish = (verdict) => {
    log(`push-suite: ${verdict}`);
    if (verdict.startsWith('ok')) {
      heavyLock?.release();
      heavyLock = undefined;
    } else release();
    if (only) log(`push-suite: --only ${only} writes no verdict file`);
    else {
      const file = verdictFileOf(sha);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, verdictText(verdict, passed));
    }
    return verdict.startsWith('ok') ? 0 : 1;
  };

  if (only && !STEPS.includes(only)) return finish(`blocked unknown step ${only}, expected one of ${STEPS.join(', ')}`);

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
  const { DRAWING_BUILDS, exportCommit, toolsStepEnv } = await import('./commit-export.mjs');
  const { dir, error } = INNER_EXPORT ? { dir: INNER_EXPORT } : exportCommit(root, sha);
  const removeExport = () => (INNER_EXPORT ? undefined : rmSync(dir, { recursive: true, force: true }));
  if (!INNER_EXPORT)
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
      process.once(signal, () => {
        release();
        removeExport();
        process.exit(1);
      });

  let built;
  const buildDrawingLibs = () =>
    (built ??= runStep('npx', ['nx', 'run-many', '-t', 'build', '-p', ...DRAWING_BUILDS], dir));
  const afterBuild = async (run) => {
    const build = await buildDrawingLibs();
    return build.status === 0 ? run() : build;
  };

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
    tools: () => runStep('yarn', ['test:tools'], dir, undefined, toolsStepEnv(root)),
    cli: () => runStep('npx', ['nx', 'test', 'cli'], dir),
    studio: () => runStep('npx', ['nx', 'test', 'ethlete-studio'], dir),
    quota: () => {
      const changed = git('diff', '--name-only', '--diff-filter=d', range);
      if (changed.status !== 0) return Promise.resolve({ status: 1, output: changed.stderr });
      return quotaStep(quotaSpecFiles(changed.stdout.split('\n').filter(Boolean)), {
        run: (command, args) => runStep(command, args, dir),
      });
    },
    e2e: () => afterBuild(() => runStep(process.execPath, [join(dir, RUNNER)], dir, E2E_LOG)),
    'e2e-quota': () =>
      afterBuild(async () => {
        const { affectedCases, caseSpans, changedLines, TRIGGERS } = await import('./studio-e2e-repeat.mjs');
        const diff = git('diff', '-U0', range, '--', ...TRIGGERS);
        if (diff.status !== 0) return { status: 1, output: diff.stderr };
        const spans = caseSpans(readFileSync(join(dir, RUNNER), 'utf8'));
        const built = mkdtempSync(join(tmpdir(), 'push-suite-e2e-quota-'));
        try {
          return await e2eQuotaStep(affectedCases(changedLines(diff.stdout), spans), {
            run: (command, args) => runStep(command, args, dir),
            build: () =>
              runStep(
                'npx',
                [
                  'nx',
                  'build',
                  'ethlete-studio',
                  `--outputPath=${built}`,
                  '--excludeTaskDependencies',
                  '--skip-nx-cache',
                ],
                dir,
              ),
            built,
          });
        } finally {
          rmSync(built, { recursive: true, force: true });
        }
      }),
    'e2e-load': () =>
      afterBuild(async () => {
        const { e2eLoadStep } = await import('./ci-like-load.mjs');
        const changed = git('diff', '--name-only', range);
        if (changed.status !== 0) return { status: 1, output: changed.stderr };
        return e2eLoadStep(changed.stdout.split('\n').filter(Boolean), {
          run: (command, args) => runStep(command, args, dir, E2E_LOAD_LOG),
          runner: join(dir, RUNNER),
        });
      }),
    'first-listing': () =>
      afterBuild(async () => {
        const { firstListingStep, timeFirstListing } = await import('./first-listing-time.mjs');
        const changed = git('diff', '--name-only', range);
        if (changed.status !== 0) return { status: 1, output: changed.stderr };
        return firstListingStep(changed.stdout.split('\n').filter(Boolean), {
          measure: (options) => timeFirstListing(dir, options),
          prepareBase: async () => {
            const base = git('rev-parse', '--verify', `${range.split(/\.{2,3}/)[0] || 'HEAD'}^{commit}`);
            if (base.status !== 0) throw new Error(`no base commit for ${range}: ${base.stderr.trim()}`);
            const baseSha = base.stdout.trim();
            const exported = exportCommit(root, baseSha, 'push-suite-base');
            const remove = () => rmSync(exported.dir, { recursive: true, force: true });
            if (exported.error) {
              remove();
              throw new Error(`the export of base ${baseSha.slice(0, 12)} failed: ${exported.error}`);
            }
            const build = await runStep(
              'npx',
              ['nx', 'run-many', '-t', 'build', '-p', ...DRAWING_BUILDS],
              exported.dir,
            );
            if (build.status !== 0) {
              remove();
              throw new Error(`the build of base ${baseSha.slice(0, 12)} failed:\n${build.output.slice(-2000)}`);
            }
            return { measure: (options) => timeFirstListing(exported.dir, options), remove };
          },
        });
      }),
    repeat: () =>
      afterBuild(async () => {
        const { changedLines, runRepeatGate, TRIGGERS } = await import('./studio-e2e-repeat.mjs');
        const diff = git('diff', '-U0', range, '--', ...TRIGGERS);
        if (diff.status !== 0) return { status: 1, output: diff.stderr };
        const lines = [];
        const status = await runRepeatGate(diff.stdout, {
          log: (line) => lines.push(line),
          cwd: dir,
          liveLog: REPEAT_LOG,
        });
        const touched = [...changedLines(diff.stdout).keys()].length;
        return { status, output: lines.join('\n'), note: touched ? undefined : `no trigger change in ${range}` };
      }),
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
    const reused = only
      ? new Map()
      : reusableSteps(git('rev-parse', `${sha}^@`).stdout.split('\n').filter(Boolean), readVerdict, (first) => {
          const changed = git('diff', '--name-only', first, sha);
          return changed.status === 0 ? changed.stdout.split('\n').filter(Boolean) : undefined;
        });
    for (const name of only ? [only] : STEPS) {
      const from = reused.get(name);
      if (from) {
        log(reusedLine(name, from));
        passed.set(name, from);
        continue;
      }
      const startedAt = performance.now();
      const stopSampling = sampleMaxLoad(loadProbe.load, loadProbe.timers);
      const { status, output, note } = await withStepTmp(name, steps[name]);
      const maxLoad = stopSampling();
      log(stepLine(name, status, performance.now() - startedAt, note, (loadProbe.load ?? oneMinuteLoad)(), maxLoad));
      if (status !== 0) {
        log(failureReport(output));
        return finish(`blocked ${name} failed at ${sha}`);
      }
      if ((name === 'repeat' || name === 'first-listing') && output) log(output);
      passed.set(name, sha);
    }
    return finish(`ok ${sha}`);
  } finally {
    removeExport();
  }
};

const readVerdict = (commit) => {
  const file = verdictFileOf(commit);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

export const checkPush = async (base, sha, log = console.error) => {
  if (process.env['PUSH_SUITE_SKIP'] === '1') return 0;
  const { EXEMPT_PATHS, parseLog, reusedVerdictLine, verdictBelow } = await import('./verdict-reuse.mjs');
  const commits = parseLog(git('log', '--format=%x00%H', '--name-only', `${base}..${sha}`).stdout);
  const hasOk = (commit) => readVerdict(commit)?.startsWith('ok ') ?? false;
  const below = verdictBelow(commits, hasOk, EXEMPT_PATHS);
  if (below.onTop) log(reusedVerdictLine('pre-push', below));
  const missing = below.blocker;
  if (!missing) return 0;
  log(
    `pre-push: ${missing.slice(0, 10)} changes more than plans/, .changeset/ or Markdown, and no later commit in this push has an ok verdict. Run \`yarn push:suite\` on this HEAD and push after \`push-suite: ok\`; PUSH_SUITE_SKIP=1 skips the check for a push the suite does not cover.`,
  );
  return 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  process.exit(argv[0] === '--check' ? await checkPush(argv[1], argv[2]) : await pushSuite(parseArgs(argv)));
}
