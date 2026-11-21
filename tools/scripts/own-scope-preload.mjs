import { realpathSync } from 'node:fs';
import { isMainThread } from 'node:worker_threads';

const HEAVY_ENTRIES = [
  ['nx', /[\\/]node_modules[\\/]nx[\\/](?:dist[\\/])?bin[\\/]nx\.js$/],
  ['vitest', /[\\/]node_modules[\\/]vitest[\\/]vitest\.mjs$/],
  ['tsc', /[\\/]node_modules[\\/]typescript[\\/]bin[\\/]tsc$/],
];

export const DEV_JOB_LIMITS = { memoryHigh: '16G', memoryMax: '20G' };

export const heavyJobOf = (entry, realpath = realpathSync) => {
  if (!entry) return undefined;
  let resolved;
  try {
    resolved = realpath(entry);
  } catch {
    return undefined;
  }
  return HEAVY_ENTRIES.find(([, pattern]) => pattern.test(resolved))?.[0];
};

export const devJobLimits = (env = process.env) => ({
  memoryHigh: env['ETHLETE_OWN_SCOPE_MEMORY_HIGH'] || env['ETHLETE_OWN_SCOPE_MEMORY_MAX'] || DEV_JOB_LIMITS.memoryHigh,
  memoryMax: env['ETHLETE_OWN_SCOPE_MEMORY_MAX'] || DEV_JOB_LIMITS.memoryMax,
});

const job = isMainThread ? heavyJobOf(process.argv[1]) : undefined;
if (job) {
  const { enterOwnScope } = await import('./own-scope.mjs');
  enterOwnScope(job, { limits: devJobLimits() });
}
