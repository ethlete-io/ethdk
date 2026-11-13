#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { HOLD_LISTINGS_MS, runOnce } from './studio-e2e-repeat.mjs';

const USAGE =
  'usage: node tools/scripts/design-server-proof.mjs [--target <checkout>] [--cli <index.js>] [--part <sketch>] [--only P1] [--load <busy processes>]';

export const P1_TARGETS = { coldMs: 10_000, warmMs: 5_000, warmRuns: 3 };
export const P5_TARGETS = { runs: 5 };
export const P5_CASE = 'B498 R3';

/** The proofs of B499 (plan `plans/ethlete-studio/design-to-code.md`, "B499 proof"); a proof without `run` is not built yet. */
export const PROOFS = [
  { id: 'P1', title: 'sketch check cold <= 10 s, warm <= 5 s (3 runs), also with CI=1' },
  { id: 'P2', title: 'shot 5 runs: from run 2 no server or browser start, each <= 2 s' },
  { id: 'P3', title: 'one owner: with design serve up, one design process and one Chrome root per checkout' },
  { id: 'P4', title: 'idle end: idle 60 s; after 90 s no server and no Chromium left' },
  { id: 'P5', title: 'e2e "B498 R3" case 5x through studio:e2e:repeat: 0 empty cells, 0 ECONNRESET' },
  { id: 'P6', title: 'no main-thread block > 1 s in a slow-checks poll; warm /__design/system <= 300 ms' },
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

const RUNNERS = { P1: proveP1, P5: proveP5 };

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
    const run = RUNNERS[id];

    if (run) passed.push(await run(options));
    else console.log(`${id} not built yet: ${title}`);
  }

  process.exit(passed.every(Boolean) ? 0 : 1);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
