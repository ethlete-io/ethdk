#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { cpus, loadavg, platform, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const INNER_EXPORT = process.env['PUSH_SUITE_EXPORT'];
const root = process.env['PUSH_SUITE_REPO'] ?? resolve(import.meta.dirname, '../..');
export const E2E_LOG = join(root, '.claude/handoffs/push-suite-e2e.log');
export const REPEAT_LOG = join(root, '.claude/handoffs/push-suite-repeat.log');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';
const WORKSPACE_PARENTS = ['apps', 'libs', 'tools'];
const DRAWING_BUILDS = ['cli', 'components', 'core'];

export const STEPS = ['lint', 'typecheck', 'cli', 'studio', 'quota', 'e2e', 'e2e-quota', 'repeat'];
export const EXEMPT_PATHS = [/^plans\//, /^\.changeset\//, /\.md$/];

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

export const linkTargetOf = (repo, entry, link) => {
  if (link === undefined || isAbsolute(link)) return entry;
  const target = relative(repo, resolve(dirname(entry), link)).split(sep);
  const intoWorkspace = target[0] !== '..' && !target.includes('node_modules');
  return intoWorkspace ? link : entry;
};

export const missingVerdict = (commits, hasOk) => {
  for (const { sha, files } of commits) {
    if (hasOk(sha)) return undefined;
    if (files.some((file) => !EXEMPT_PATHS.some((path) => path.test(file)))) return sha;
  }
  return undefined;
};

export const parseLog = (output) =>
  output
    .split('\0')
    .filter((entry) => entry.trim())
    .map((entry) => {
      const [sha, ...files] = entry.split('\n').filter(Boolean);
      return { sha, files };
    });

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
export const QUOTA_PERCENT_DARWIN = 20;
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
  const { runChecks } = await import('./pre-push-checks.mjs');
  const failed = runChecks(base.stdout.trim(), head.stdout.trim(), { cwd: root, log: (line) => lines.push(line) });
  const names = [...(format.status === 0 ? [] : ['format']), ...failed.map((item) => item.check)];
  return { status: names.length ? 1 : 0, output: lines.join('\n'), names };
};

export const stepLine = (name, status, ms, note, load, max = load) =>
  `push-suite: ${name} ${status === 0 ? 'ok' : `failed at load ${formatLoad(load)} (max ${formatLoad(max)} during the step)`} in ${seconds(ms)}${note ? ` (${note})` : ''}`;

const linkDependencies = (from, to) => {
  mkdirSync(to);
  for (const name of readdirSync(from)) {
    const entry = join(from, name);
    const link = lstatSync(entry).isSymbolicLink() ? readlinkSync(entry) : undefined;
    if (link === undefined && name.startsWith('@')) linkDependencies(entry, join(to, name));
    else symlinkSync(linkTargetOf(root, entry, link), join(to, name));
  }
};

const exportCommit = (sha) => {
  const dir = mkdtempSync(join(tmpdir(), `push-suite-${sha.slice(0, 12)}-`));
  const extract = spawnSync('bash', ['-c', 'set -o pipefail; git archive "$1" | tar -x -C "$2"', 'export', sha, dir], {
    cwd: root,
    encoding: 'utf8',
  });
  if (extract.status !== 0) return { dir, error: extract.stderr.trim() || `git archive exited ${extract.status}` };
  linkDependencies(join(root, 'node_modules'), join(dir, 'node_modules'));
  for (const parent of WORKSPACE_PARENTS)
    for (const name of readdirSync(join(dir, parent))) {
      const dependencies = join(root, parent, name, 'node_modules');
      if (existsSync(dependencies)) linkDependencies(dependencies, join(dir, parent, name, 'node_modules'));
    }
  return { dir };
};

export const runStep = async (command, args, cwd, logFile) => {
  const runLog = logFile ? (await import('./run-log.mjs')).startRunLog(logFile) : undefined;

  return new Promise((done) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
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

export const pushSuite = async ({ only, range, maxLoad }, log = console.log, loadProbe = {}) => {
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  const finish = (verdict) => {
    log(`push-suite: ${verdict}`);
    if (only) log(`push-suite: --only ${only} writes no verdict file`);
    else {
      const file = verdictFileOf(sha);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, `${verdict}\n`);
    }
    return verdict.startsWith('ok') ? 0 : 1;
  };

  if (only && !STEPS.includes(only)) return finish(`blocked unknown step ${only}, expected one of ${STEPS.join(', ')}`);

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
  const { dir, error } = INNER_EXPORT ? { dir: INNER_EXPORT } : exportCommit(sha);
  const removeExport = () => (INNER_EXPORT ? undefined : rmSync(dir, { recursive: true, force: true }));
  if (!INNER_EXPORT)
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
      process.once(signal, () => {
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
      return await runInner(reexecCommand(dir, root, { only, range }));
    }
    await warnStaleDesignServers(log);
    for (const name of only ? [only] : STEPS) {
      const startedAt = performance.now();
      const stopSampling = sampleMaxLoad(loadProbe.load, loadProbe.timers);
      const { status, output, note } = await steps[name]();
      const maxLoad = stopSampling();
      log(stepLine(name, status, performance.now() - startedAt, note, (loadProbe.load ?? oneMinuteLoad)(), maxLoad));
      if (status !== 0) {
        log(failureReport(output));
        return finish(`blocked ${name} failed at ${sha}`);
      }
      if (name === 'repeat' && output) log(output);
    }
    return finish(`ok ${sha}`);
  } finally {
    removeExport();
  }
};

export const checkPush = (base, sha, log = console.error) => {
  if (process.env['PUSH_SUITE_SKIP'] === '1') return 0;
  const commits = parseLog(git('log', '--format=%x00%H', '--name-only', `${base}..${sha}`).stdout);
  const hasOk = (commit) => {
    const file = verdictFileOf(commit);
    return existsSync(file) && readFileSync(file, 'utf8').startsWith('ok ');
  };
  const missing = missingVerdict(commits, hasOk);
  if (!missing) return 0;
  log(
    `pre-push: ${missing.slice(0, 10)} changes more than plans/, .changeset/ or Markdown, and no later commit in this push has an ok verdict. Run \`yarn push:suite\` on this HEAD and push after \`push-suite: ok\`; PUSH_SUITE_SKIP=1 skips the check for a push the suite does not cover.`,
  );
  return 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  process.exit(argv[0] === '--check' ? checkPush(argv[1], argv[2]) : await pushSuite(parseArgs(argv)));
}
