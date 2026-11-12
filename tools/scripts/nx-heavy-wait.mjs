import { spawnSync } from 'node:child_process';
import { HEAVY_LOCK_MAX_WAIT_MS, HEAVY_LOCK_POLL_MS, holderLine, waitForNoHeavyRun } from './heavy-run-lock.mjs';

export const name = 'ethlete-heavy-wait';

// Nx rejects an isolated plugin's hook call after 10 min (isolated-plugin.js MAX_MESSAGE_WAIT).
const HOOK_MAX_WAIT_MS = 9 * 60_000;

// Nx passes no env to the hook, and the daemon's worker holds the env of whichever client connected last.
const CALLER_FLAGS = ['ETHLETE_HEAVY_EXEMPT', 'ETHLETE_HEAVY_RUN_HELD'];

const underNxDaemon = () =>
  /[\\/]daemon[\\/]server[\\/]start\.js\b/.test(
    spawnSync('ps', ['-o', 'command=', '-p', String(process.ppid)], { encoding: 'utf8' }).stdout ?? '',
  );

/**
 * Waits before an Nx run while another process holds the heavy-run lock; see `waitForNoHeavyRun`. A design wrapper's
 * build (env `ETHLETE_HEAVY_EXEMPT`) never waits; `ETHLETE_HEAVY_NO_WAIT` refuses at once. Under the Nx daemon the
 * exempt and held flags are ignored, so a caller that needs them runs with `NX_DAEMON=false`.
 */
export const heavyWaitBeforeTasks = async ({ env = process.env, onDaemon = false, ...lock } = {}) => {
  const own = onDaemon ? Object.fromEntries(Object.entries(env).filter(([key]) => !CALLER_FLAGS.includes(key))) : env;
  if (own['ETHLETE_HEAVY_EXEMPT']) return { ok: true };
  return waitForNoHeavyRun('nx', {
    wait: !own['ETHLETE_HEAVY_NO_WAIT'],
    maxWaitMs: Math.min(Number(own['ETHLETE_HEAVY_MAX_WAIT_MS']) || HEAVY_LOCK_MAX_WAIT_MS, HOOK_MAX_WAIT_MS),
    pollMs: Number(own['ETHLETE_HEAVY_POLL_MS']) || HEAVY_LOCK_POLL_MS,
    env: own,
    ...lock,
  });
};

export const preTasksExecution = async () => {
  const onDaemon = underNxDaemon();
  const free = await heavyWaitBeforeTasks({ onDaemon });
  if (free.ok) return;
  const ignored = onDaemon && CALLER_FLAGS.some((key) => process.env[key]);
  throw new Error(
    `nx: ${holderLine(free.holder)}; run again after it ends${ignored ? ', or with NX_DAEMON=false' : ''}`,
  );
};
