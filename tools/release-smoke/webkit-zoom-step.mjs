import { spawn, spawnSync } from 'node:child_process';
import { loadavg } from 'node:os';
import { resolve } from 'node:path';

export const WEBKIT_ZOOM_CASE = 'ctrl-wheel zoom over 100 cells keeps the frame interval budget';
export const ZOOM_P50_BUDGET_MS = 20;
export const ZOOM_RUNS = 3;
export const MAX_LOAD = 8;
export const MAX_LOAD_WAIT_MS = 5 * 60_000;
const LOAD_POLL_MS = 15_000;

export const webkitZoomPlan = () => ({
  command: 'node',
  args: [
    'tools/scripts/heavy.mjs',
    'run',
    '--on',
    'tank',
    '--',
    'yarn',
    'studio:e2e',
    '--perf',
    '--engine',
    'webkit',
    '--case',
    WEBKIT_ZOOM_CASE,
  ],
});

export const p50Of = (output) => {
  const match = /frame interval p50 ([\d.]+) ms/.exec(output);
  return match ? Number(match[1]) : null;
};

export const medianOf = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const repoRoot = resolve(import.meta.dirname, '../..');
const scratchScript = resolve(repoRoot, 'tools/scripts/scratch-checkout.mjs');

const runCaptured = (command, args, { cwd } = {}) =>
  new Promise((resolvePromise) => {
    console.log(`  $ ${command} ${args.join(' ')}`);
    let output = '';
    const child = spawn(command, args, { cwd, stdio: ['inherit', 'pipe', 'pipe'] });
    const echo = (target) => (chunk) => {
      output += chunk;
      target.write(chunk);
    };
    child.stdout.on('data', echo(process.stdout));
    child.stderr.on('data', echo(process.stderr));
    child.on('exit', () => resolvePromise(output));
    child.on('error', () => resolvePromise(output));
  });

const makeScratch = () => {
  const made = spawnSync('node', [scratchScript], { cwd: repoRoot, encoding: 'utf8' });
  if (made.status !== 0) throw new Error(`scratch checkout failed: ${made.stderr.trim()}`);
  return made.stdout.trim();
};

const removeScratch = (dir) => spawnSync('node', [scratchScript, '--remove', dir], { cwd: repoRoot, stdio: 'inherit' });

const defaults = {
  runCaptured,
  makeScratch,
  removeScratch,
  load: () => loadavg()[0],
  sleep: (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
  now: () => Date.now(),
};

const waitForCalmTank = async ({ load, sleep, now }) => {
  const start = now();
  while (load() >= MAX_LOAD && now() - start < MAX_LOAD_WAIT_MS) await sleep(LOAD_POLL_MS);
  return load();
};

export const runWebkitZoomStep = async (deps = {}) => {
  const { runCaptured: runCase, load, sleep, now, makeScratch: make, removeScratch: remove } = { ...defaults, ...deps };
  const { command, args } = webkitZoomPlan();
  const scratch = make();
  try {
    const samples = [];
    for (let i = 0; i < ZOOM_RUNS; i++) {
      const startLoad = await waitForCalmTank({ load, sleep, now });
      const p50 = p50Of(await runCase(command, args, { cwd: scratch }));
      console.log(
        `  webkit zoom run ${i + 1}/${ZOOM_RUNS}: p50 ${p50 ?? 'missing'} ms (tank load ${startLoad.toFixed(1)})`,
      );
      samples.push({ p50, load: startLoad });
    }
    const runs = samples.map(({ p50, load: l }) => `${p50 ?? 'missing'} ms @ load ${l.toFixed(1)}`).join(', ');
    if (samples.some(({ p50 }) => p50 === null)) {
      return `WebKit zoom gate failed: a run printed no p50 (${runs}), case "${WEBKIT_ZOOM_CASE}" on tank (B910)`;
    }
    const median = medianOf(samples.map(({ p50 }) => p50));
    return median <= ZOOM_P50_BUDGET_MS
      ? null
      : `WebKit zoom gate failed: median p50 ${median} ms > ${ZOOM_P50_BUDGET_MS} ms (${runs}), case "${WEBKIT_ZOOM_CASE}" on tank (B910)`;
  } finally {
    remove(scratch);
  }
};

export const webkitGateResult = (failure) => ({
  name: 'webkit zoom gate',
  failures: failure ? [failure] : [],
  notes: [],
  warnings: [],
});
