#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { CI_LIKE, hasTaskset, loadPassTriggers, pinnedCommand, startBusyLoops } from './ci-like-load.mjs';
import { holderLine } from './heavy-run-lock.mjs';

export const FIRST_LISTING_LIMIT_MS = 15_000;
const FIRST_LISTING_PATH = '/__design/sketches?product=studio';
const SERVER_READY_MS = 120_000;
const LISTING_TIMEOUT_MS = 120_000;

const secondsOf = (ms) => `${(ms / 1000).toFixed(2)} s`;

/** Whether a first listing that took `ms` and answered `listed` sketches passes the gate. */
export const firstListingVerdict = ({ ms, listed }, limit = FIRST_LISTING_LIMIT_MS) => {
  if (listed === 0) return { ok: false, line: `first studio listing answered no sketch after ${secondsOf(ms)}` };
  return {
    ok: ms < limit,
    line: `first studio listing took ${secondsOf(ms)} for ${listed} sketches, limit ${secondsOf(limit)}`,
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

/** The push suite's first-listing step: under the CI-like load, for design server changes. */
export const firstListingStep = async (
  files,
  { measure, busy = startBusyLoops, taskset = hasTaskset(), limit = FIRST_LISTING_LIMIT_MS },
) => {
  const triggers = loadPassTriggers(files);
  if (triggers.length === 0) return { status: 0, output: '', note: 'no design server change' };
  const load = await busy(CI_LIKE.busyLoops, { taskset });
  if (!load.ok) return { status: 1, output: '', note: `no load started: ${holderLine(load.holder)}` };
  try {
    const verdict = firstListingVerdict(await measure({ taskset }), limit);
    const note = `CI-like: ${CI_LIKE.busyLoops} busy loops, ${taskset ? `pinned to cores ${CI_LIKE.cores}` : 'ran unpinned: no taskset on this machine'}`;
    return { status: verdict.ok ? 0 : 1, output: verdict.line, note };
  } catch (error) {
    return { status: 1, output: error instanceof Error ? error.message : String(error) };
  } finally {
    load.stop();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const limitAt = args.indexOf('--limit-ms');
  const limit = limitAt === -1 ? FIRST_LISTING_LIMIT_MS : Number(args[limitAt + 1]);
  const built = resolve(
    args.find((arg, index) => !arg.startsWith('--') && (limitAt === -1 || index !== limitAt + 1)) ?? '.',
  );
  const result = await firstListingStep(['libs/cli/src/lib/design/'], {
    measure: (options) => timeFirstListing(built, options),
    busy: (count, options) => startBusyLoops(count, { ...options, lock: { wait: true } }),
    limit,
  });
  console.log([result.output, result.note].filter(Boolean).join('\n'));
  process.exit(result.status);
}
