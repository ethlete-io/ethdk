#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { pathToFileURL } from 'node:url';
import { holderLine, takeHeavyLock } from './heavy-run-lock.mjs';

export const CI_LIKE = { cores: '0-3', workers: 2, busyLoops: 12, shard: '1/6' };

export const LOAD_PASS_TRIGGERS = ['libs/cli/src/lib/design/'];

export const loadPassTriggers = (files) =>
  files.filter((file) => LOAD_PASS_TRIGGERS.some((dir) => file.startsWith(dir)));

export const hasTaskset = (os = platform()) =>
  os === 'linux' && spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;

/** Wraps a command so it runs on `cores` only; without `taskset` it runs unpinned and says so in `note`. */
export const pinnedCommand = (command, args, { cores = CI_LIKE.cores, taskset = hasTaskset() } = {}) =>
  taskset
    ? { command: 'taskset', args: ['--cpu-list', cores, command, ...args], note: `pinned to cores ${cores}` }
    : { command, args, note: 'ran unpinned: no taskset on this machine' };

const BUSY = 'const parent=Number(process.argv[1]);while(process.ppid===parent);';

/**
 * Takes the heavy run lock, then starts `count` busy loops on the same cores as the pinned command. Resolves to
 * `{ ok, stop }`, where `stop` ends the loops and releases the lock, or to `{ ok: false, holder }` when another run
 * holds the lock and `lock.wait` is false. Under a holder (env `ETHLETE_HEAVY_RUN_HELD`) it takes no lock of its own.
 */
export const startBusyLoops = async (count = CI_LIKE.busyLoops, { lock = {}, ...options } = {}) => {
  const held = await takeHeavyLock('ci-like-load', lock);
  if (!held.ok) return held;
  const { command, args } = pinnedCommand(process.execPath, ['-e', BUSY, String(process.pid)], options);
  const loops = Array.from({ length: count }, () => spawn(command, args, { stdio: 'ignore' }));
  return {
    ok: true,
    stop: () => {
      for (const loop of loops) loop.kill('SIGKILL');
      held.release();
    },
  };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dash = process.argv.indexOf('--');
  if (dash === -1 || dash === process.argv.length - 1) {
    console.error('usage: node tools/scripts/ci-like-load.mjs [--busy <n>] -- <command> [args...]');
    process.exit(2);
  }
  const busyAt = process.argv.indexOf('--busy');
  const busy = busyAt !== -1 && busyAt < dash ? Number(process.argv[busyAt + 1]) : CI_LIKE.busyLoops;
  const [command, ...args] = process.argv.slice(dash + 1);
  const pinned = pinnedCommand(command, args);
  const load = await startBusyLoops(busy);
  if (!load.ok) {
    console.error(`ci-like-load: ${holderLine(load.holder)}`);
    process.exit(1);
  }
  console.error(`ci-like-load: ${busy} busy loops, ${pinned.note}`);
  const child = spawn(pinned.command, pinned.args, { stdio: 'inherit' });
  const end = (code) => {
    load.stop();
    process.exit(code ?? 1);
  };
  child.on('exit', end);
  child.on('error', () => end(1));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}
