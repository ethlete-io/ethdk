import { performance } from 'perf_hooks';
import { recordPhase } from './timings';

/**
 * Runs `run` and records its duration as a phase of the design run in progress. With `ETHLETE_DESIGN_PHASES=1` it also
 * writes `PHASE <name> <seconds>s` to stderr when it settles.
 */
export const timedPhase = <T>(name: string, run: () => T): T => {
  const start = performance.now();
  const done = () => {
    const ms = performance.now() - start;

    recordPhase(name, ms);

    if (process.env['ETHLETE_DESIGN_PHASES'] === '1')
      process.stderr.write(`PHASE ${name} ${(ms / 1000).toFixed(2)}s\n`);
  };
  const result = run();

  if (result instanceof Promise) return result.finally(done) as T;

  done();

  return result;
};
