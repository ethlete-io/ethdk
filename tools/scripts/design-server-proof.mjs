#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { HOLD_LISTINGS_MS, runOnce } from './studio-e2e-repeat.mjs';

const USAGE =
  'usage: node tools/scripts/design-server-proof.mjs [--target <checkout>] [--cli <index.js>] [--part <sketch>] [--only <P1..P7>] [--load <busy processes>]';

export const P1_TARGETS = { coldMs: 10_000, warmMs: 5_000, warmRuns: 3 };
export const P5_TARGETS = { runs: 5 };
export const P5_CASE = 'B498 R3';

/** The proofs of B499 (plan `plans/ethlete-studio/design-to-code.md`, "B499 proof"). */
export const PROOFS = [
  { id: 'P1', title: 'sketch check cold <= 10 s, warm <= 5 s (3 runs), also with CI=1' },
  { id: 'P2', title: 'shot 5 runs: from run 2 no server or browser start, each <= 2 s' },
  { id: 'P3', title: 'one owner: with design serve up, one design process and one Chrome root per checkout' },
  { id: 'P4', title: 'idle end: idle 60 s; after 90 s no server and no Chromium left' },
  { id: 'P5', title: 'e2e "B498 R3" case 5x through studio:e2e:repeat: 0 empty cells, 0 ECONNRESET' },
  {
    id: 'P6',
    title:
      'no main-thread block > 1 s in a slow-checks poll; warm /__design/system <= 300 ms; cold open-points <= 1.5 s',
  },
  { id: 'P7', title: 'spec: two parallel rules() calls make 1 worker run; abort cancels the work' },
];

/** The `PHASE <name> <seconds>s` lines that `ETHLETE_DESIGN_PHASES=1` writes, as `{ name, ms }` in order. */
export const phasesOf = (text) =>
  text.split('\n').flatMap((line) => {
    const match = /^PHASE (.+) (\d+(?:\.\d+)?)s$/.exec(line.trim());

    return match ? [{ name: match[1], ms: Math.round(Number(match[2]) * 1000) }] : [];
  });

/** Judges one P1 mode: `runs[0]` is the cold run, the rest are warm. */
export const judgeP1 = (runs, targets = P1_TARGETS) => {
  const [cold, ...warm] = runs;
  const failures = [
    ...(cold && cold.ok && cold.ms <= targets.coldMs
      ? []
      : [`cold ${secondsOf(cold?.ms)} > ${secondsOf(targets.coldMs)}`]),
    ...(warm.length < targets.warmRuns ? [`${warm.length} warm runs, need ${targets.warmRuns}`] : []),
    ...warm.flatMap((run, index) =>
      run.ok && run.ms <= targets.warmMs
        ? []
        : [`warm ${index + 1} ${secondsOf(run.ms)} > ${secondsOf(targets.warmMs)}`],
    ),
    ...runs.flatMap((run, index) => (run.ok ? [] : [`run ${index + 1} exited ${run.status}`])),
  ];

  return { pass: failures.length === 0, failures };
};

const secondsOf = (ms) => (ms === undefined ? '-' : `${(ms / 1000).toFixed(1)} s`);

/** One line per run: the wall time and its slowest phases. */
export const runLineOf = (label, run) => {
  const slowest = [...run.phases]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
    .map((phase) => `${phase.name} ${secondsOf(phase.ms)}`)
    .join(', ');

  return `  ${label.padEnd(7)} ${secondsOf(run.ms).padStart(7)}${run.ok ? '' : ` (exit ${run.status})`}  ${slowest}`;
};

export const argsOf = (argv) => {
  const options = { target: process.cwd(), cli: null, part: 'components/command-palette', only: null, load: '0' };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--help' || flag === '-h') return { error: USAGE, code: 0 };
    if (!['--target', '--cli', '--part', '--only', '--load'].includes(flag))
      return { error: `unknown flag ${flag}\n${USAGE}`, code: 2 };
    if (!value || value.startsWith('--')) return { error: `${flag} needs a value\n${USAGE}`, code: 2 };

    options[flag.slice(2)] = value;
    index += 1;
  }

  const target = resolve(options.target);
  const load = Number(options.load);

  if (!Number.isInteger(load) || load < 0) return { error: `--load needs a whole number\n${USAGE}`, code: 2 };

  return { ...options, load, target, cli: resolve(options.cli ?? join(target, 'dist/libs/cli/src/index.js')) };
};

const design = ({ target, cli }, args, env) => {
  const start = performance.now();
  const result = spawnSync(process.execPath, [cli, 'design', ...args], {
    cwd: target,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return {
    ms: Math.round(performance.now() - start),
    ok: result.status === 0,
    status: result.status ?? result.signal,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
};

const WORK_ROOT = 'node_modules/.design-explore';

const coldStart = (options) => {
  const work = join(options.target, WORK_ROOT);

  design(options, ['stop'], {});
  rmSync(join(options.target, 'node_modules/.cache/ethlete-design'), { recursive: true, force: true });

  if (existsSync(work))
    readdirSync(work)
      .filter((name) => name.endsWith('.tsbuildinfo'))
      .forEach((name) => rmSync(join(work, name), { force: true }));
};

const proveP1 = (options) => {
  const modes = [
    { label: 'local', env: {} },
    { label: 'CI=1', env: { CI: '1' } },
  ];
  const results = modes.map(({ label, env }) => {
    coldStart(options);

    const runs = Array.from({ length: P1_TARGETS.warmRuns + 1 }, () => {
      const run = design(options, ['sketch', 'check', options.part], { ...env, ETHLETE_DESIGN_PHASES: '1' });

      return { ...run, phases: phasesOf(run.output) };
    });
    const verdict = judgeP1(runs);

    console.log(`P1 ${label}: ${verdict.pass ? 'pass' : `FAIL - ${verdict.failures.join('; ')}`}`);
    runs.forEach((run, index) => console.log(runLineOf(index === 0 ? 'cold' : `warm ${index}`, run)));

    return verdict.pass;
  });

  design(options, ['stop'], {});

  return results.every(Boolean);
};

/** Reads one canvas e2e run of the P5 case: did it pass, how many empty cell samples and columns, how many ECONNRESET. */
export const p5RunOf = (output) => {
  const row = output.split('\n').find((line) => /^ {2}[✓✘] +\d+ \[[^\]]+\] › /.test(line) && line.includes(P5_CASE));
  const columns = /columns with no cell: ([^;|]+?)(?:;|$)/m.exec(row ?? '')?.[1].split(', ').length ?? 0;

  return {
    passed: !!row && row.startsWith('  ✓'),
    empty: Number(/(\d+) empty samples of cells/.exec(row ?? '')?.[1] ?? 0) + columns,
    resets: output.match(/ECONNRESET/g)?.length ?? 0,
  };
};

export const judgeP5 = (runs, targets = P5_TARGETS) => {
  const failures = [
    ...(runs.length < targets.runs ? [`${runs.length} runs, need ${targets.runs}`] : []),
    ...runs.flatMap((run, index) => [
      ...(run.passed ? [] : [`run ${index + 1} did not pass`]),
      ...(run.empty ? [`run ${index + 1}: ${run.empty} empty cells`] : []),
      ...(run.resets ? [`run ${index + 1}: ${run.resets} ECONNRESET`] : []),
    ]),
  ];

  return { pass: failures.length === 0, failures };
};

const burn = (count) =>
  Array.from({ length: count }, () =>
    spawn(process.execPath, ['-e', 'const e=Date.now()+36e5;while(Date.now()<e);'], { stdio: 'ignore' }),
  );

const proveP5 = async (options) => {
  const runner = join(options.target, 'apps/ethlete-studio/e2e/canvas.e2e.mjs');
  const built = mkdtempSync(join(tmpdir(), 'design-server-proof-p5-'));
  const hogs = burn(options.load);

  try {
    execFileSync(
      'npx',
      ['nx', 'build', 'ethlete-studio', `--outputPath=${built}`, '--excludeTaskDependencies', '--skip-nx-cache'],
      { cwd: options.target, stdio: 'ignore', env: { ...process.env, NX_NO_CLOUD: 'true' } },
    );

    const runs = [];

    for (let index = 0; index < P5_TARGETS.runs; index += 1) {
      const hold = index === P5_TARGETS.runs - 1 ? ['--hold-listings', String(HOLD_LISTINGS_MS)] : [];
      const output = await runOnce(
        runner,
        ['--proof', 'B498', '--case', P5_CASE, '--built', built, ...hold],
        options.target,
      );

      runs.push(p5RunOf(output));
    }

    const verdict = judgeP5(runs);

    console.log(
      `P5${options.load ? ` (--load ${options.load})` : ''}: ${verdict.pass ? 'pass' : `FAIL - ${verdict.failures.join('; ')}`}`,
    );
    runs.forEach((run, index) =>
      console.log(
        `  run ${index + 1}${index === P5_TARGETS.runs - 1 ? ` (--hold-listings ${HOLD_LISTINGS_MS})` : ''}: ${run.passed ? 'pass' : 'FAIL'}, ${run.empty} empty cells, ${run.resets} ECONNRESET`,
      ),
    );

    return verdict.pass;
  } finally {
    hogs.forEach((hog) => hog.kill());
    rmSync(built, { recursive: true, force: true });
  }
};

export const P2_TARGETS = { runs: 5, warmMs: 2_000 };
export const P2_SHOT = ['components/zoom-chip', '--state', 'out'];
export const P3_COMPARE = ['components/zoom-chip', '--product', 'studio'];
export const P4_TARGETS = { idleMs: 60_000, waitMs: 90_000 };
export const P6_TARGETS = { blockMs: 1_000, systemWarmMs: 300, openPointsColdMs: 1_500 };
export const P7_SPECS = [
  'src/lib/design/system/sketch/sketch-checker.spec.ts',
  'src/lib/design/resident/server.spec.ts',
];

const RESIDENT_START = 'starting the resident design process';
const START_PHASES = ['server-start', 'browser-start'];

/** The rows of `ps -eo pid=,ppid=,args=` as `{ pid, ppid, args }`. */
export const psRowsOf = (text) =>
  text.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);

    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), args: match[3] }] : [];
  });

const isChromium = (args) => /(chrome|chromium|headless_shell)[^/\s]*(\s|$)/i.test(args.split(' --')[0]);
const isDesignProcess = (args) => /\/cli\/src\/index\.js design( __resident\b|$)/.test(args);

/**
 * The design processes (`design serve`, `__resident`) whose working directory is `target`, the Chromium roots under
 * them (a Chromium process whose parent is no Chromium) and every Chromium process under them.
 */
export const ownersOf = (rows, { target, cwdOf }) => {
  const design = rows.filter((row) => isDesignProcess(row.args) && cwdOf(row.pid) === target).map((row) => row.pid);
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const under = (row) => {
    for (let parent = byPid.get(row.ppid); parent; parent = byPid.get(parent.ppid))
      if (design.includes(parent.pid)) return true;

    return false;
  };
  const chromium = rows.filter((row) => isChromium(row.args) && under(row));
  const roots = chromium.filter((row) => !isChromium(byPid.get(row.ppid)?.args ?? '')).map((row) => row.pid);

  return { design, roots, chromium: chromium.map((row) => row.pid) };
};

const cwdOf = (pid) => {
  try {
    return realpathSync(`/proc/${pid}/cwd`);
  } catch {
    return null;
  }
};

const ownersNow = (target) =>
  ownersOf(psRowsOf(execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' })), {
    target: realpathSync(target),
    cwdOf,
  });

/** What one shot run started: the resident (cold start) and the server or browser start phases it printed. */
export const p2RunOf = (output) => ({
  residentStart: output.includes(RESIDENT_START),
  starts: phasesOf(output)
    .map((phase) => phase.name)
    .filter((name) => START_PHASES.includes(name)),
});

const sameOwners = (one, other) =>
  JSON.stringify([one.design, one.roots]) === JSON.stringify([other.design, other.roots]);

/** Judges P2: from run 2 no resident, server or browser start, the same design process and Chromium root, each run in time. */
export const judgeP2 = (runs, targets = P2_TARGETS) => {
  const [first, ...later] = runs;
  const failures = [
    ...(runs.length < targets.runs ? [`${runs.length} runs, need ${targets.runs}`] : []),
    ...runs.flatMap((run, index) => (run.ok ? [] : [`run ${index + 1} exited ${run.status}`])),
    ...later.flatMap((run, index) => [
      ...(run.residentStart ? [`run ${index + 2} started the resident`] : []),
      ...(run.starts.length ? [`run ${index + 2} started ${run.starts.join(', ')}`] : []),
      ...(first && !sameOwners(first.owners, run.owners)
        ? [`run ${index + 2} drew with other processes (${ownerLineOf(first.owners)} -> ${ownerLineOf(run.owners)})`]
        : []),
      ...(run.ms > targets.warmMs ? [`run ${index + 2} ${secondsOf(run.ms)} > ${secondsOf(targets.warmMs)}`] : []),
    ]),
  ];

  return { pass: failures.length === 0, failures };
};

export const ownerLineOf = (owners) =>
  `design ${owners.design.join(',') || '-'}, Chrome roots ${owners.roots.join(',') || '-'}`;

/** Judges P3: one design process and one Chromium root of the checkout. */
export const judgeP3 = (owners, runs) => {
  const failures = [
    ...runs.flatMap((run) => (run.ok ? [] : [`${run.label} exited ${run.status}`])),
    ...(owners.design.length === 1 ? [] : [`${owners.design.length} design processes`]),
    ...(owners.roots.length === 1 ? [] : [`${owners.roots.length} Chrome roots`]),
  ];

  return { pass: failures.length === 0, failures };
};

/** Judges P4: right after the run its resident and Chromium ran, after the wait none of them is left. */
export const judgeP4 = ({ run, before, after, alive }) => {
  const failures = [
    ...(run.ok ? [] : [`the run exited ${run.status}`]),
    ...(before.design.length ? [] : ['no design process right after the run']),
    ...(after.design.length ? [`${after.design.length} design processes left`] : []),
    ...(alive.length ? [`${alive.length} Chromium processes left`] : []),
  ];

  return { pass: failures.length === 0, failures };
};

/**
 * The slow-checks window of a serve log (`{ at, line }` entries): from the first product run it started to its last
 * `done`, once every started product is done; `null` while one still runs.
 */
export const slowWindowOf = (entries) => {
  const started = new Map();
  const done = new Map();

  for (const { at, line } of entries) {
    const match = /slow checks: (\S+) (done, (\d+) problem)?/.exec(line);

    if (!match) continue;
    if (match[2]) done.set(match[1], { at, problems: Number(match[3]) });
    else if (!started.has(match[1])) started.set(match[1], at);
  }

  if (started.size === 0 || [...started.keys()].some((name) => !done.has(name))) return null;

  return {
    from: Math.min(...started.values()),
    to: Math.max(...[...done.values()].map((entry) => entry.at)),
    problems: Object.fromEntries([...done].map(([name, entry]) => [name, entry.problems])),
  };
};

/** The longest main-thread block that overlaps `[from, to]`, 0 for none. */
export const worstBlockOf = (blocks, { from, to }) =>
  Math.max(0, ...blocks.filter((block) => block.at >= from && block.at - block.ms <= to).map((block) => block.ms));

export const judgeP6 = (measured, targets = P6_TARGETS) => {
  const failures = [
    ...(measured.window ? [] : ['no slow-checks poll ran to its end']),
    ...(measured.blockMs > targets.blockMs ? [`main-thread block ${measured.blockMs} ms > ${targets.blockMs} ms`] : []),
    ...(measured.systemWarmMs > targets.systemWarmMs
      ? [`warm /__design/system ${measured.systemWarmMs} ms > ${targets.systemWarmMs} ms`]
      : []),
    ...(measured.openPointsColdMs > targets.openPointsColdMs
      ? [`cold /__design/open-points ${measured.openPointsColdMs} ms > ${targets.openPointsColdMs} ms`]
      : []),
  ];

  return { pass: failures.length === 0, failures };
};

/** The totals of a vitest run: `{ passed, failed, files }`, `null` when it printed none. */
export const vitestTotalsOf = (output) => {
  const plain = stripVTControlCharacters(output);
  const tests = /^\s*Tests\s+(.*)$/m.exec(plain)?.[1];

  if (!tests) return null;

  const count = (word) => Number(new RegExp(`(\\d+) ${word}`).exec(tests)?.[1] ?? 0);

  return { passed: count('passed'), failed: count('failed') };
};

const freePort = () =>
  new Promise((done, fail) => {
    const server = createNetServer();

    server.on('error', fail);
    server.listen(0, () => {
      const { port } = server.address();

      server.close(() => done(port));
    });
  });

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/** Starts `design serve` on a free port in its own process group; `stop()` ends the group. */
const startServe = async (options, env) => {
  const port = await freePort();
  const entries = [];
  const child = spawn(process.execPath, [options.cli, 'design'], {
    cwd: options.target,
    env: { ...process.env, ...env, DE_PORT: String(port) },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const take = (chunk) =>
    String(chunk)
      .split('\n')
      .filter(Boolean)
      .forEach((line) => entries.push({ at: Date.now(), line }));

  child.stdout.on('data', take);
  child.stderr.on('data', take);

  const exited = new Promise((done) => child.on('exit', done));
  const stop = async () => {
    if (child.exitCode !== null) return;

    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      return;
    }
    if ((await Promise.race([exited.then(() => true), pause(15_000)])) === true) return;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      return;
    }
  };

  return { port, pid: child.pid, entries, stop };
};

const timedGet = async (url) => {
  const start = performance.now();
  const response = await fetch(url);

  await response.arrayBuffer();

  return { status: response.status, ms: Math.round(performance.now() - start) };
};

const untilServed = async (serve, deadlineMs = 180_000) => {
  const end = Date.now() + deadlineMs;

  while (Date.now() < end) {
    for (const host of ['127.0.0.1', '[::1]']) {
      const answer = await timedGet(`http://${host}:${serve.port}/__design/system`).catch(() => null);

      if (answer?.status === 200) {
        serve.base = `http://${host}:${serve.port}`;

        return answer;
      }
    }

    await pause(500);
  }

  throw new Error(
    `design serve did not answer /__design/system in ${deadlineMs / 1000} s:\n${serve.entries
      .slice(-20)
      .map((entry) => entry.line)
      .join('\n')}`,
  );
};

const verdictLine = (id, verdict) => `${id}: ${verdict.pass ? 'pass' : `FAIL - ${verdict.failures.join('; ')}`}`;

const proveP2 = (options) => {
  design(options, ['stop'], {});

  if (existsSync(join(options.target, '.scratch-checkout')))
    console.log('P2 note: the scratch marker .scratch-checkout stops the resident after each run; move it aside');

  const runs = Array.from({ length: P2_TARGETS.runs }, () => {
    const run = design(options, ['shot', ...P2_SHOT], { ETHLETE_DESIGN_PHASES: '1' });

    return { ...run, ...p2RunOf(run.output), owners: ownersNow(options.target) };
  });
  const verdict = judgeP2(runs);

  console.log(verdictLine('P2', verdict));
  runs.forEach((run, index) =>
    console.log(
      `  run ${index + 1} ${secondsOf(run.ms).padStart(7)}${run.residentStart ? ' resident start' : ''}${run.starts.length ? ` ${run.starts.join(', ')}` : ''}  ${ownerLineOf(run.owners)}`,
    ),
  );
  design(options, ['stop'], {});

  return verdict.pass;
};

const proveP3 = async (options) => {
  design(options, ['stop'], {});

  const serve = await startServe(options, { ETHLETE_DESIGN_SLOW_CHECKS: 'off' });

  try {
    await untilServed(serve);

    const runs = [
      { label: `sketch check ${options.part}`, args: ['sketch', 'check', options.part] },
      { label: `shot ${P2_SHOT.join(' ')}`, args: ['shot', ...P2_SHOT] },
      { label: `compare ${P3_COMPARE.join(' ')}`, args: ['compare', ...P3_COMPARE] },
    ].map(({ label, args }) => ({ label, ...design(options, args, {}) }));
    const owners = ownersNow(options.target);
    const verdict = judgeP3(owners, runs);

    console.log(verdictLine('P3', verdict));
    runs.forEach((run) => console.log(`  ${run.label}: ${secondsOf(run.ms)}${run.ok ? '' : ` (exit ${run.status})`}`));
    console.log(`  after them: ${ownerLineOf(owners)}, ${owners.chromium.length} Chromium processes`);

    return verdict.pass;
  } finally {
    await serve.stop();
  }
};

const proveP4 = async (options) => {
  design(options, ['stop'], {});

  const env = { ETHLETE_DESIGN_IDLE_MS: String(P4_TARGETS.idleMs) };
  const run = design(options, ['sketch', 'check', options.part], env);
  const before = ownersNow(options.target);

  await pause(P4_TARGETS.waitMs);

  const after = ownersNow(options.target);
  const running = new Set(
    psRowsOf(execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' })).map((row) => row.pid),
  );
  const alive = before.chromium.filter((pid) => running.has(pid));
  const verdict = judgeP4({ run, before, after, alive });

  console.log(verdictLine('P4', verdict));
  console.log(`  sketch check ${secondsOf(run.ms)} with ETHLETE_DESIGN_IDLE_MS=${P4_TARGETS.idleMs}`);
  console.log(`  right after: ${ownerLineOf(before)}, ${before.chromium.length} Chromium processes`);
  console.log(
    `  ${P4_TARGETS.waitMs / 1000} s later: ${ownerLineOf(after)}, ${alive.length} of those Chromium processes left`,
  );
  alive.forEach((pid) => process.kill(pid, 'SIGKILL'));

  return verdict.pass;
};

const proveP6 = async (options) => {
  coldStart(options);

  const probes = mkdtempSync(join(tmpdir(), 'design-server-proof-p6-'));
  const probe = join(import.meta.dirname, 'design-server-proof-probe.mjs');
  const serve = await startServe(options, {
    DESIGN_PROOF_PROBE_DIR: probes,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(probe).href}`.trim(),
    ETHLETE_DESIGN_SLOW_CHECKS: 'on',
  });

  try {
    await untilServed(serve);

    const openPoints = await timedGet(`${serve.base}/__design/open-points`);
    const system = await timedGet(`${serve.base}/__design/system`);
    const end = Date.now() + 15 * 60_000;
    let window = null;

    while (!window && Date.now() < end) {
      await pause(1_000);
      window = slowWindowOf(serve.entries);
    }

    await pause(1_000);

    const file = join(probes, `${serve.pid}.json`);
    const blocks = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    const measured = {
      window,
      blockMs: window ? worstBlockOf(blocks, window) : 0,
      systemWarmMs: system.ms,
      openPointsColdMs: openPoints.ms,
    };
    const verdict = judgeP6(measured);

    console.log(verdictLine('P6', verdict));
    console.log(
      `  slow-checks poll: ${
        window
          ? `${secondsOf(window.to - window.from)}, ${Object.entries(window.problems)
              .map(([name, count]) => `${name} ${count} problem(s)`)
              .join(', ')}`
          : 'did not end in 15 min'
      }; worst main-thread block ${measured.blockMs} ms`,
    );
    console.log(
      `  warm /__design/system ${system.ms} ms (${system.status}); cold /__design/open-points ${openPoints.ms} ms (${openPoints.status})`,
    );

    return verdict.pass;
  } finally {
    await serve.stop();
    rmSync(probes, { recursive: true, force: true });
  }
};

const proveP7 = (options) => {
  const result = spawnSync('npx', ['vitest', 'run', ...P7_SPECS], {
    cwd: join(options.target, 'libs/cli'),
    encoding: 'utf8',
    env: { ...process.env, TMUX: '' },
  });
  const totals = vitestTotalsOf(`${result.stdout}${result.stderr}`);
  const pass = result.status === 0 && !!totals && totals.failed === 0 && totals.passed > 0;

  console.log(`P7: ${pass ? 'pass' : `FAIL - exit ${result.status}`}`);
  console.log(`  ${P7_SPECS.join(', ')}: ${totals ? `${totals.passed} passed, ${totals.failed} failed` : 'no totals'}`);

  return pass;
};

const RUNNERS = { P1: proveP1, P2: proveP2, P3: proveP3, P4: proveP4, P5: proveP5, P6: proveP6, P7: proveP7 };

const main = async () => {
  const options = argsOf(process.argv.slice(2));

  if (options.error) {
    console.error(options.error);
    process.exit(options.code);
  }
  if (!existsSync(options.cli)) {
    console.error(`design-server-proof: no CLI build at ${options.cli} - run \`npx nx build cli\` in the checkout`);
    process.exit(2);
  }

  if (!options.only || options.only === 'P1')
    console.log(
      `cold = no design process, no node_modules/.cache/ethlete-design and no ${WORK_ROOT}/*.tsbuildinfo in ${options.target}`,
    );

  const passed = [];

  for (const { id, title } of PROOFS.filter(({ id }) => !options.only || id === options.only)) {
    console.log(`${id} ${title}`);
    passed.push(await RUNNERS[id](options));
  }

  process.exit(passed.every(Boolean) ? 0 : 1);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
