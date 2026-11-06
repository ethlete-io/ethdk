import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import {
  costliestPhaseOf,
  isNoisy,
  isStale,
  isUnexplained,
  labelOf,
  TIMING_TARGETS,
  TimingLine,
  timingsFileOf,
  UNEXPLAINED_SHARE,
} from './timings';

export const TIMINGS_USAGE = 'timings [--since <n>m|h|d] [--command <command>]';

const LISTED = 10;
const UNITS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

export const sinceMsOf = (value: string) => {
  const match = /^(\d+)([mhd])$/.exec(value);

  return match ? Number(match[1]) * (UNITS[match[2] ?? ''] ?? 0) : null;
};

const matchesCommand = (line: TimingLine, command: string) =>
  labelOf(line) === command || line.command === command || line.command.startsWith(`${command} `);

const secondsOf = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const runOf = (line: TimingLine, head: string | null) =>
  [
    line.start,
    labelOf(line),
    ...line.parts,
    secondsOf(line.totalMs),
    line.unphasedMs === undefined ? '' : `(unphased ${secondsOf(line.unphasedMs)})`,
    line.exit === 0 ? '' : `exit ${line.exit}`,
    line.commit ? `@${line.commit.sha}${line.commit.dirty ? '+dirty' : ''}` : '',
    line.load ? `load ${line.load.avg1.toFixed(1)}/${line.load.cores}` : '',
    isStale(line, head) ? 'STALE' : '',
    isNoisy(line) ? 'NOISY' : '',
    isUnexplained(line) ? 'UNEXPLAINED' : '',
  ]
    .filter(Boolean)
    .join(' ');

const padded = (rows: string[][]) => {
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length))) ?? [];

  return rows.map((row) => `  ${row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ')}`.trimEnd());
};

export const parseTimings = (text: string) =>
  text.split('\n').flatMap((raw): TimingLine[] => {
    if (!raw.trim()) return [];

    try {
      const line = JSON.parse(raw) as TimingLine;

      return typeof line.command === 'string' && typeof line.totalMs === 'number' ? [line] : [];
    } catch {
      return [];
    }
  });

/**
 * The timings report of `lines`. Each run shows its commit and load; a target verdict counts only the clean runs: not
 * noisy, and at `head` (the checkout's short sha, `null` when unknown).
 */
export const timingsReportOf = (options: {
  lines: TimingLine[];
  now: number;
  sinceMs: number;
  command?: string;
  head?: string | null;
}) => {
  const { now, sinceMs, command, head = null } = options;
  const isClean = (line: TimingLine) => !isNoisy(line) && !isStale(line, head);
  const from = now - sinceMs;
  const lines = options.lines.filter(
    (line) => Date.parse(line.start) >= from && (command === undefined || matchesCommand(line, command)),
  );
  const header = `${lines.length} design runs since ${new Date(from).toISOString()}${command ? ` (${command})` : ''}`;

  if (lines.length === 0) return header;

  const byLabel = new Map<string, TimingLine[]>();

  lines.forEach((line) => byLabel.set(labelOf(line), [...(byLabel.get(labelOf(line)) ?? []), line]));

  const commands = [...byLabel.entries()]
    .map(([label, runs]) => ({
      label,
      runs,
      median: medianOf(runs.map((run) => run.totalMs)),
      clean: runs.filter(isClean).map((run) => run.totalMs),
      target: TIMING_TARGETS[label],
    }))
    .sort((a, b) => b.median - a.median);
  const over = lines.filter((line) => {
    const target = TIMING_TARGETS[labelOf(line)];

    return target !== undefined && line.totalMs > target;
  });
  const misses = over.filter(isClean).sort((a, b) => b.start.localeCompare(a.start));
  const phases = new Map<string, number[]>();

  lines.forEach((line) =>
    line.phases.forEach((phase) => phases.set(phase.name, [...(phases.get(phase.name) ?? []), phase.ms])),
  );

  const slowestPhases = [...phases.entries()]
    .map(([name, values]) => ({ name, values, total: values.reduce((sum, ms) => sum + ms, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, LISTED);
  const slowestRuns = [...lines].sort((a, b) => b.totalMs - a.totalMs).slice(0, LISTED);
  const unexplained = lines.filter(isUnexplained).sort((a, b) => b.start.localeCompare(a.start));

  return [
    header,
    '',
    'median per command:',
    ...padded([
      ['command', 'runs', 'median', 'max', 'clean', 'clean median', 'target', ''],
      ...commands.map(({ label, runs, median, clean, target }) => [
        label,
        String(runs.length),
        secondsOf(median),
        secondsOf(Math.max(...runs.map((run) => run.totalMs))),
        String(clean.length),
        clean.length === 0 ? '-' : secondsOf(medianOf(clean)),
        target === undefined ? '-' : secondsOf(target),
        target === undefined ? '' : clean.length === 0 ? 'no clean run' : medianOf(clean) <= target ? 'ok' : 'MISS',
      ]),
    ]),
    '',
    `clean runs over their target: ${misses.length}${over.length > misses.length ? ` (${over.length - misses.length} more stale or noisy, no verdict)` : ''}`,
    ...misses.slice(0, LISTED).map((line) => {
      const costliest = costliestPhaseOf(line);
      const target = TIMING_TARGETS[labelOf(line)] ?? 0;

      return `  ${runOf(line, head)} > ${secondsOf(target)} - most expensive phase ${costliest ? `${costliest.name} ${secondsOf(costliest.ms)}` : 'none recorded'}`;
    }),
    ...(misses.length > LISTED ? [`  and ${misses.length - LISTED} more`] : []),
    '',
    `runs with unexplained time (unphased over ${UNEXPLAINED_SHARE * 100} % of the run): ${unexplained.length}`,
    ...unexplained.slice(0, LISTED).map((line) => `  ${runOf(line, head)}`),
    ...(unexplained.length > LISTED ? [`  and ${unexplained.length - LISTED} more`] : []),
    '',
    'slowest phases (total over all runs):',
    ...padded([
      ['phase', 'runs', 'total', 'median', 'max'],
      ...slowestPhases.map(({ name, values, total }) => [
        name,
        String(values.length),
        secondsOf(total),
        secondsOf(medianOf(values)),
        secondsOf(Math.max(...values)),
      ]),
    ]),
    '',
    'slowest runs:',
    ...slowestRuns.map((line) => `  ${runOf(line, head)}`),
  ].join('\n');
};

const flagOf = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);

  return index === -1 ? undefined : argv[index + 1];
};

const headOf = (checkout: string) => {
  try {
    return execFileSync('git', ['-C', checkout, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
};

/** `et design timings`: reports the logged timings of the design runs of the checkout. */
export const designTimings = (options: { target: string; argv: string[]; invocation: string; now?: number }) => {
  const { target, argv, invocation, now = Date.now() } = options;
  const since = flagOf(argv, '--since') ?? '1d';
  const sinceMs = sinceMsOf(since);
  const command = flagOf(argv, '--command');

  if (sinceMs === null || (argv.includes('--command') && !command)) {
    console.error(`usage: ${invocation} ${TIMINGS_USAGE}`);

    return 2;
  }

  const file = timingsFileOf(target);
  const lines = existsSync(file) ? parseTimings(readFileSync(file, 'utf8')) : [];

  console.log(timingsReportOf({ lines, now, sinceMs, command, head: headOf(target) }));

  return 0;
};
