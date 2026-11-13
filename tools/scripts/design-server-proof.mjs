#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const USAGE =
  'usage: node tools/scripts/design-server-proof.mjs [--target <checkout>] [--cli <index.js>] [--part <sketch>] [--only P1]';

export const P1_TARGETS = { coldMs: 10_000, warmMs: 5_000, warmRuns: 3 };

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
  const options = { target: process.cwd(), cli: null, part: 'components/command-palette', only: null };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--help' || flag === '-h') return { error: USAGE, code: 0 };
    if (!['--target', '--cli', '--part', '--only'].includes(flag))
      return { error: `unknown flag ${flag}\n${USAGE}`, code: 2 };
    if (!value || value.startsWith('--')) return { error: `${flag} needs a value\n${USAGE}`, code: 2 };

    options[flag.slice(2)] = value;
    index += 1;
  }

  const target = resolve(options.target);

  return { ...options, target, cli: resolve(options.cli ?? join(target, 'dist/libs/cli/src/index.js')) };
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

const RUNNERS = { P1: proveP1 };

const main = () => {
  const options = argsOf(process.argv.slice(2));

  if (options.error) {
    console.error(options.error);
    process.exit(options.code);
  }
  if (!existsSync(options.cli)) {
    console.error(`design-server-proof: no CLI build at ${options.cli} - run \`npx nx build cli\` in the checkout`);
    process.exit(2);
  }

  console.log(
    `cold = no design process, no node_modules/.cache/ethlete-design and no ${WORK_ROOT}/*.tsbuildinfo in ${options.target}`,
  );

  const passed = PROOFS.filter(({ id }) => !options.only || id === options.only).map(({ id, title }) => {
    const run = RUNNERS[id];

    if (!run) {
      console.log(`${id} not built yet: ${title}`);
      return true;
    }

    return run(options);
  });

  process.exit(passed.every(Boolean) ? 0 : 1);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
