import { performance } from 'perf_hooks';

/** Runs `run`; with `ETHLETE_DESIGN_PHASES=1` it writes `PHASE <name> <seconds>s` to stderr when it settles. */
export const timedPhase = <T>(name: string, run: () => T): T => {
  if (process.env['ETHLETE_DESIGN_PHASES'] !== '1') return run();

  const start = performance.now();
  const done = () => process.stderr.write(`PHASE ${name} ${((performance.now() - start) / 1000).toFixed(2)}s\n`);
  const result = run();

  if (result instanceof Promise) return result.finally(done) as T;

  done();

  return result;
};
