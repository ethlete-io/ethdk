import { existsSync, readFileSync } from 'fs';
import { TimingLine, TimingPhase, timingsFileOf } from './timings';

export const TIMINGS_USAGE = 'timings [--since <n>m|h|d] [--command <command>]';

export const TIMING_TARGETS: Record<string, number> = {
  compare: 5_000,
  'sketch check': 10_000,
  'sketch ready': 10_000,
  'check (full)': 60_000,
};

const LISTED = 10;
const NARROWING_CHECK_FLAGS = new Set(['--call', '--lint', '--tsconfig']);
const UNITS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

export const sinceMsOf = (value: string) => {
  const match = /^(\d+)([mhd])$/.exec(value);

  return match ? Number(match[1]) * (UNITS[match[2] ?? ''] ?? 0) : null;
};

export const labelOf = (line: TimingLine) =>
  line.command === 'check' && line.parts.length === 0 && !line.args.some((arg) => NARROWING_CHECK_FLAGS.has(arg))
    ? 'check (full)'
    : line.command;

const matchesCommand = (line: TimingLine, command: string) =>
  labelOf(line) === command || line.command === command || line.command.startsWith(`${command} `);

const secondsOf = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const costliestOf = (phases: TimingPhase[]) =>
  phases.reduce<TimingPhase | null>((best, phase) => (best === null || phase.ms > best.ms ? phase : best), null);

const runOf = (line: TimingLine) =>
  [line.start, labelOf(line), ...line.parts, secondsOf(line.totalMs), line.exit === 0 ? '' : `exit ${line.exit}`]
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

export const timingsReportOf = (options: { lines: TimingLine[]; now: number; sinceMs: number; command?: string }) => {
  const { now, sinceMs, command } = options;
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
      target: TIMING_TARGETS[label],
    }))
    .sort((a, b) => b.median - a.median);
  const misses = lines
    .filter((line) => {
      const target = TIMING_TARGETS[labelOf(line)];

      return target !== undefined && line.totalMs > target;
    })
    .sort((a, b) => b.start.localeCompare(a.start));
  const phases = new Map<string, number[]>();

  lines.forEach((line) =>
    line.phases.forEach((phase) => phases.set(phase.name, [...(phases.get(phase.name) ?? []), phase.ms])),
  );

  const slowestPhases = [...phases.entries()]
    .map(([name, values]) => ({ name, values, total: values.reduce((sum, ms) => sum + ms, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, LISTED);
  const slowestRuns = [...lines].sort((a, b) => b.totalMs - a.totalMs).slice(0, LISTED);

  return [
    header,
    '',
    'median per command:',
    ...padded([
      ['command', 'runs', 'median', 'max', 'target', ''],
      ...commands.map(({ label, runs, median, target }) => [
        label,
        String(runs.length),
        secondsOf(median),
        secondsOf(Math.max(...runs.map((run) => run.totalMs))),
        target === undefined ? '-' : secondsOf(target),
        target === undefined ? '' : median <= target ? 'ok' : 'MISS',
      ]),
    ]),
    '',
    `runs over their target: ${misses.length}`,
    ...misses.slice(0, LISTED).map((line) => {
      const costliest = costliestOf(line.phases);
      const target = TIMING_TARGETS[labelOf(line)] ?? 0;

      return `  ${runOf(line)} > ${secondsOf(target)} - most expensive phase ${costliest ? `${costliest.name} ${secondsOf(costliest.ms)}` : 'none recorded'}`;
    }),
    ...(misses.length > LISTED ? [`  and ${misses.length - LISTED} more`] : []),
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
    ...slowestRuns.map((line) => `  ${runOf(line)}`),
  ].join('\n');
};

const flagOf = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);

  return index === -1 ? undefined : argv[index + 1];
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

  console.log(timingsReportOf({ lines, now, sinceMs, command }));

  return 0;
};
