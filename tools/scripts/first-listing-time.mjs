#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { CI_LIKE, hasTaskset, loadPassTriggers, pinnedCommand, startBusyLoops } from './ci-like-load.mjs';
import { holderLine } from './heavy-run-lock.mjs';

export const FIRST_LISTING_LIMIT_MS = 15_000;
export const FIRST_LISTING_ROUNDS = 3;
export const FIRST_LISTING_SLACK_MS = 3_000;
export const FIRST_LISTING_SLACK_SHARE = 0.2;
const FIRST_LISTING_PATH = '/__design/sketches?product=studio';
const SERVER_READY_MS = 120_000;
const LISTING_TIMEOUT_MS = 120_000;

const messageOf = (error) => (error instanceof Error ? error.message : String(error));
const secondsOf = (ms) => `${(ms / 1000).toFixed(2)} s`;
const medianOf = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const timesOf = (samples) => samples.map(({ ms }) => (ms / 1000).toFixed(2)).join('/');

/**
 * Judges head's first listings against base's, measured alternately under the same load: head fails when its median is
 * slower than base's by more than max(3 s, 20 %). The 15 s limit is only reported.
 */
export const firstListingVerdict = (base, head, limit = FIRST_LISTING_LIMIT_MS) => {
  const empty = [...base.map((sample) => ['base', sample]), ...head.map((sample) => ['head', sample])].find(
    ([, { listed }]) => listed === 0,
  );
  if (empty)
    return {
      ok: false,
      line: `first studio listing on ${empty[0]} answered no sketch after ${secondsOf(empty[1].ms)}`,
    };
  const baseMs = medianOf(base.map(({ ms }) => ms));
  const headMs = medianOf(head.map(({ ms }) => ms));
  const slack = Math.max(FIRST_LISTING_SLACK_MS, baseMs * FIRST_LISTING_SLACK_SHARE);
  const ok = headMs - baseMs <= slack;
  const over = [headMs >= limit && 'head', baseMs >= limit && 'base'].filter(Boolean);
  return {
    ok,
    line: [
      `first studio listing median head ${secondsOf(headMs)} (${timesOf(head)}) vs base ${secondsOf(baseMs)} (${timesOf(base)}),`,
      `${head[0]?.listed} sketches; rule: fail when head is slower than base by more than max(3 s, 20 %) = ${secondsOf(slack)};`,
      `${ok ? 'passed' : 'FAILED'}, ${over.length ? `${over.join(' and ')} over` : 'both under'} the ${secondsOf(limit)} reference`,
    ].join(' '),
  };
};

const prepareCheckout = (built) => {
  const prepared = spawnSync(
    process.execPath,
    [join(built, 'apps/ethlete-studio/e2e/canvas.e2e.mjs'), '--prepare-checkout', '--cold-shots'],
    { cwd: built, encoding: 'utf8' },
  );
  const dir = prepared.stdout.trim().split('\n').at(-1);
  if (prepared.status !== 0 || !dir) throw new Error(`could not prepare the e2e checkout: ${prepared.stderr.trim()}`);
  return dir;
};

const portOf = (server) =>
  new Promise((settle, reject) => {
    let output = '';
    const timer = setTimeout(
      () => reject(new Error(`the design server was not ready in ${secondsOf(SERVER_READY_MS)}`)),
      SERVER_READY_MS,
    );
    const read = (chunk) => {
      output += chunk;
      const port = /Local:\s+https?:\/\/localhost:(\d+)/.exec(stripVTControlCharacters(output))?.[1];
      if (!port) return;
      clearTimeout(timer);
      settle(Number(port));
    };
    server.stdout.on('data', read);
    server.stderr.on('data', read);
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`the design server exited with ${code} before it was ready\n${output.slice(-2000)}`));
    });
  });

/**
 * Starts the built design server of `built` on a cold copy of the e2e fixture checkout, with slow checks off as the e2e
 * worker sets them, and times its first studio sketch listing.
 */
export const timeFirstListing = async (built, { taskset = hasTaskset() } = {}) => {
  const checkout = prepareCheckout(built);
  const { command, args } = pinnedCommand(
    process.execPath,
    [join(built, 'dist/libs/cli/src/index.js'), 'design', checkout],
    { taskset },
  );
  const server = spawn(command, args, {
    cwd: checkout,
    env: { ...process.env, ETHLETE_DESIGN_SLOW_CHECKS: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await portOf(server);
    const startedAt = performance.now();
    const response = await fetch(`http://[::1]:${port}${FIRST_LISTING_PATH}`, {
      signal: AbortSignal.timeout(LISTING_TIMEOUT_MS),
    });
    const body = await response.text();
    const ms = performance.now() - startedAt;
    if (!response.ok) throw new Error(`the first listing answered ${response.status}: ${body.slice(0, 500)}`);
    return { ms, listed: JSON.parse(body).sketches?.length ?? 0 };
  } finally {
    server.kill('SIGKILL');
    rmSync(checkout, { recursive: true, force: true });
  }
};

/**
 * The push suite's first-listing step: for design server changes, prepares the base build, then times base and head
 * alternately under the CI-like load and judges the difference.
 */
export const firstListingStep = async (
  files,
  {
    measure,
    prepareBase,
    busy = startBusyLoops,
    taskset = hasTaskset(),
    limit = FIRST_LISTING_LIMIT_MS,
    rounds = FIRST_LISTING_ROUNDS,
  },
) => {
  const triggers = loadPassTriggers(files);
  if (triggers.length === 0) return { status: 0, output: '', note: 'no design server change' };
  let base;
  try {
    base = await prepareBase();
  } catch (error) {
    return { status: 1, output: `the base measure failed: ${messageOf(error)}` };
  }
  const load = await busy(CI_LIKE.busyLoops, { taskset });
  if (!load.ok) {
    base.remove();
    return { status: 1, output: '', note: `no load started: ${holderLine(load.holder)}` };
  }
  let phase = 'base';
  try {
    const samples = { base: [], head: [] };
    for (let round = 0; round < rounds; round++) {
      phase = 'base';
      samples.base.push(await base.measure({ taskset }));
      phase = 'head';
      samples.head.push(await measure({ taskset }));
    }
    const verdict = firstListingVerdict(samples.base, samples.head, limit);
    const note = `CI-like: ${CI_LIKE.busyLoops} busy loops, ${taskset ? `pinned to cores ${CI_LIKE.cores}` : 'ran unpinned: no taskset on this machine'}`;
    return { status: verdict.ok ? 0 : 1, output: verdict.line, note };
  } catch (error) {
    return { status: 1, output: `the ${phase} measure failed: ${messageOf(error)}` };
  } finally {
    load.stop();
    base.remove();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const flagValues = new Set([valueOf('--limit-ms'), valueOf('--base')]);
  const limit = Number(valueOf('--limit-ms') ?? FIRST_LISTING_LIMIT_MS);
  const built = resolve(args.find((arg) => !arg.startsWith('--') && !flagValues.has(arg)) ?? '.');
  const baseBuilt = valueOf('--base');
  const result = await firstListingStep(['libs/cli/src/lib/design/'], {
    measure: (options) => timeFirstListing(built, options),
    prepareBase: async () => {
      if (!baseBuilt) throw new Error('no --base <built checkout> given');
      return { measure: (options) => timeFirstListing(resolve(baseBuilt), options), remove: () => undefined };
    },
    busy: (count, options) => startBusyLoops(count, { ...options, lock: { wait: true } }),
    limit,
  });
  console.log([result.output, result.note].filter(Boolean).join('\n'));
  process.exit(result.status);
}
