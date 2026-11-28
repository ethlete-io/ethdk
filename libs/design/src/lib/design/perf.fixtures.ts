import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { PerformanceObserver } from 'perf_hooks';
import { interval, tap } from 'rxjs';

export const PERF_DIR = resolve(__dirname, '../../../../tmp/perf');

export const recordPerf = (name: string, measurements: Record<string, unknown>) => {
  mkdirSync(PERF_DIR, { recursive: true });
  writeFileSync(
    join(PERF_DIR, `${name}.json`),
    `${JSON.stringify({ case: name, at: new Date().toISOString(), ...measurements }, null, 2)}\n`,
  );
};

// Thread CPU time, not wall time: a loaded machine deschedules the thread, which a wall-clock bar would count as a block.
export const cpuMs = (since?: NodeJS.CpuUsage) => {
  const spent = process.threadCpuUsage(since);

  return (spent.user + spent.system) / 1000;
};

export const calibrationMs = () => {
  const from = process.threadCpuUsage();
  let sum = 0;

  for (let i = 0; i < 10_000_000; i++) sum += Math.sqrt(i);

  return Math.max(cpuMs(from), sum < 0 ? 1 : 0);
};

export type GcEntry = { startMs: number; durationMs: number; kind: number | undefined };

export const watchLongestBlock = () => {
  let longest = 0;
  let last = process.threadCpuUsage();
  const gc: GcEntry[] = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      gc.push({
        startMs: entry.startTime,
        durationMs: entry.duration,
        kind: (entry as { detail?: { kind?: number } }).detail?.kind,
      });
    }
  });

  observer.observe({ entryTypes: ['gc'] });

  const ticks = interval(5)
    .pipe(
      tap(() => {
        longest = Math.max(longest, cpuMs(last));
        last = process.threadCpuUsage();
      }),
    )
    .subscribe();

  return () => {
    ticks.unsubscribe();
    observer.disconnect();

    return { longestMs: Math.max(longest, cpuMs(last)), gc };
  };
};
