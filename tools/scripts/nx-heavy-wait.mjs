import { HEAVY_LOCK_MAX_WAIT_MS, HEAVY_LOCK_POLL_MS, holderLine, waitForNoHeavyRun } from './heavy-run-lock.mjs';

export const name = 'ethlete-heavy-wait';

// Nx rejects an isolated plugin's hook call after 10 min (isolated-plugin.js MAX_MESSAGE_WAIT).
const HOOK_MAX_WAIT_MS = 9 * 60_000;

/**
 * Waits before an Nx run while another process holds the heavy-run lock; see `waitForNoHeavyRun`. A design wrapper's
 * build (env `ETHLETE_HEAVY_EXEMPT`) never waits; `ETHLETE_HEAVY_NO_WAIT` refuses at once.
 */
export const heavyWaitBeforeTasks = async ({ env = process.env, ...lock } = {}) => {
  if (env['ETHLETE_HEAVY_EXEMPT']) return { ok: true };
  return waitForNoHeavyRun('nx', {
    wait: !env['ETHLETE_HEAVY_NO_WAIT'],
    maxWaitMs: Math.min(Number(env['ETHLETE_HEAVY_MAX_WAIT_MS']) || HEAVY_LOCK_MAX_WAIT_MS, HOOK_MAX_WAIT_MS),
    pollMs: Number(env['ETHLETE_HEAVY_POLL_MS']) || HEAVY_LOCK_POLL_MS,
    env,
    ...lock,
  });
};

export const preTasksExecution = async () => {
  const free = await heavyWaitBeforeTasks();
  if (!free.ok) throw new Error(`nx: ${holderLine(free.holder)}; run again after it ends`);
};
