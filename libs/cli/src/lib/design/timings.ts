import { execFile } from 'child_process';
import { appendFileSync } from 'fs';
import { availableParallelism, loadavg } from 'os';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';
import { setTimeout as delay } from 'timers/promises';

export const TIMINGS_FILE = '.ethlete/design/.timings.jsonl';

export const BUILD_WAIT_PHASES = ['lib-build-wait', 'harness-build', 'harness-watch-wait'];
export const BROWSER_START_PHASES = ['browser-start'];
export const SERVER_START_PHASES = ['compare-design-server'];
export const QUEUE_WAIT_PHASES = ['resident-queue-wait', 'draw-queue-wait'];

export type TimingSession = { claude: string | null; tmux: string | null; role: string | null };

/** `at` is when the phase started, in ms from the start of its run. */
export type TimingPhase = { name: string; ms: number; at?: number };

/** The checkout commit a run measured, and whether its tracked files differed from it. */
export type TimingCommit = { sha: string; dirty: boolean };

/** The 1-minute load average when a run ended, and the cores it shared. */
export type TimingLoad = { avg1: number; cores: number };

export type TimingLine = {
  command: string;
  args: string[];
  parts: string[];
  session: TimingSession | null;
  resident: boolean;
  start: string;
  totalMs: number;
  exit: number;
  phases: TimingPhase[];
  queueWaitMs: number;
  buildWaitMs: number;
  browserStartMs: number;
  serverStartMs: number;
  cache: { hits: number; misses: number };
  concurrentHeavy: number | null;
  unphasedMs?: number;
  commit?: TimingCommit | null;
  load?: TimingLoad;
};

export const TIMING_TARGETS: Record<string, number> = {
  compare: 10_000,
  'sketch check': 10_000,
  'sketch ready': 10_000,
  'check (full)': 60_000,
  'page-switch': 100,
};

export const PAGE_SWITCH_COMMAND = 'page-switch';
export const FIRST_PAGE_SWITCH_COMMAND = 'page-switch (first)';

const NARROWING_CHECK_FLAGS = new Set(['--call', '--lint', '--tsconfig']);

type Recorder = {
  began: number;
  phases: TimingPhase[];
  draws: number[];
  cache: { hits: number; misses: number };
  concurrentHeavy: number | null;
  skipped: boolean;
};

let current: Recorder | null = null;

export const timingsFileOf = (target: string) => join(target, TIMINGS_FILE);

export const recordPhase = (name: string, ms: number) => {
  if (current)
    current.phases.push({ name, ms: Math.round(ms), at: Math.round(performance.now() - current.began - ms) });
};

export const recordCache = (hit: boolean) => {
  if (!current) return;

  if (hit) current.cache.hits++;
  else current.cache.misses++;
};

/** Records how long one drawing waited in the draw queue; the run logs its longest wait. */
export const recordDrawWait = (ms: number) => void current?.draws.push(ms);

/** Records how many other heavy design runs read the lib build when this run started reading it. */
export const recordConcurrentHeavy = (count: number) => {
  if (current) current.concurrentHeavy = Math.max(current.concurrentHeavy ?? 0, count);
};

/** Drops the line of the run in progress, for a run another process logs (the resident design process). */
export const skipRunTimings = () => {
  if (current) current.skipped = true;
};

export const sessionOf = (env: NodeJS.ProcessEnv): TimingSession | null => {
  const session = {
    claude: env['CLAUDE_CODE_SESSION_ID'] || null,
    tmux: env['TMUX_PANE'] || null,
    role: env['ETHLETE_AGENT_ROLE'] || null,
  };

  return session.claude || session.tmux || session.role ? session : null;
};

const PART = /^[\w-]+\/[\w-]+$/;
const SUBCOMMAND = /^[a-z][\w-]*$/;

export const commandOf = (argv: string[]) => {
  const [command = 'serve', subcommand] = argv;

  return subcommand && SUBCOMMAND.test(subcommand) && !PART.test(subcommand) ? `${command} ${subcommand}` : command;
};

export const partsOf = (argv: string[]) =>
  argv.flatMap((arg, index) => (PART.test(arg) && (index === 0 || argv[index - 1] !== '--product') ? [arg] : []));

export const labelOf = (line: Pick<TimingLine, 'command' | 'parts' | 'args'>) =>
  line.command === 'check' && line.parts.length === 0 && !line.args.some((arg) => NARROWING_CHECK_FLAGS.has(arg))
    ? 'check (full)'
    : line.command;

/** The part of `totalMs` no recorded phase covers, or `null` when the phases carry no start. */
export const unphasedMsOf = (phases: TimingPhase[], totalMs: number) => {
  const spans = phases
    .flatMap((phase) =>
      phase.at === undefined ? [] : [[Math.max(0, phase.at), Math.min(totalMs, phase.at + phase.ms)] as const],
    )
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);

  if (spans.length === 0) return null;

  let covered = 0;
  let reached = 0;

  for (const [from, to] of spans) {
    if (to <= reached) continue;

    covered += to - Math.max(from, reached);
    reached = to;
  }

  return Math.max(0, totalMs - covered);
};

/** The phase that cost the most, the unphased time included as `unphased`. */
export const costliestPhaseOf = (line: Pick<TimingLine, 'phases' | 'unphasedMs'>) =>
  [...line.phases, ...(line.unphasedMs ? [{ name: 'unphased', ms: line.unphasedMs }] : [])].reduce<TimingPhase | null>(
    (best, phase) => (best === null || phase.ms > best.ms ? phase : best),
    null,
  );

const secondsOf = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** A run whose machine had more runnable work than cores, or did not log its load: its time is no verdict. */
export const isNoisy = (line: Pick<TimingLine, 'load'>) => !line.load || line.load.avg1 > line.load.cores;

/** A run that measured another commit than `head`, or logged none; with no `head` known nothing is stale. */
export const isStale = (line: Pick<TimingLine, 'commit'>, head: string | null) =>
  head !== null && (!line.commit || !(head.startsWith(line.commit.sha) || line.commit.sha.startsWith(head)));

/** The line a run over its target prints at the end of its output, or `null` when it met its target or has none. */
export const overTargetLineOf = (line: TimingLine) => {
  const target = TIMING_TARGETS[labelOf(line)];

  if (target === undefined || line.totalMs <= target) return null;

  const costliest = costliestPhaseOf(line);
  const noisy =
    line.load && isNoisy(line)
      ? ` (noisy: load ${line.load.avg1.toFixed(1)} > ${line.load.cores} cores, no verdict)`
      : '';

  return `over target: ${labelOf(line)} took ${secondsOf(line.totalMs)} > ${secondsOf(target)} - slowest phase ${costliest ? `${costliest.name} ${secondsOf(costliest.ms)}` : 'none recorded'}${noisy}`;
};

const gitOutputOf = (cwd: string, args: string[]) =>
  new Promise<string | null>((done) =>
    execFile('git', ['-C', cwd, ...args], { timeout: 5000 }, (error, stdout) => done(error ? null : stdout.trim())),
  );

/** The commit `checkout` is at (short sha) and whether its tracked files differ from it, or `null` outside git. */
export const checkoutCommitOf = async (checkout: string): Promise<TimingCommit | null> => {
  const [sha, changed] = await Promise.all([
    gitOutputOf(checkout, ['rev-parse', '--short', 'HEAD']),
    gitOutputOf(checkout, ['status', '--porcelain', '--untracked-files=no']),
  ]);

  return sha ? { sha, dirty: changed === null || changed !== '' } : null;
};

const machineLoadOf = (): TimingLoad => ({
  avg1: Math.round((loadavg()[0] ?? 0) * 100) / 100,
  cores: availableParallelism(),
});

const sumOf = (phases: TimingPhase[], names: string[]) =>
  phases.filter((phase) => names.includes(phase.name)).reduce((total, phase) => total + phase.ms, 0);

const COMMIT_WAIT_MS = 2000;

const defaultWrite = (file: string, text: string) => appendFileSync(file, text);

/**
 * Runs one `et design` command and appends its timings as one JSON line to `file`, also when it fails or the process
 * exits early. Writing never throws.
 */
export const recordRun = async (
  options: {
    file: string;
    argv: string[];
    resident?: boolean;
    env?: NodeJS.ProcessEnv;
    write?: (file: string, text: string) => void;
    commitOf?: (checkout: string) => Promise<TimingCommit | null>;
    loadOf?: () => TimingLoad;
  },
  run: () => Promise<number>,
): Promise<number> => {
  const {
    file,
    argv,
    resident = false,
    env = process.env,
    write = defaultWrite,
    commitOf = checkoutCommitOf,
    loadOf = machineLoadOf,
  } = options;
  const recorder: Recorder = {
    began: performance.now(),
    phases: [],
    draws: [],
    cache: { hits: 0, misses: 0 },
    concurrentHeavy: null,
    skipped: false,
  };
  const outer = current;
  const start = new Date();
  const began = recorder.began;
  const session = sessionOf(env);
  let written = false;
  let commit: TimingCommit | null = null;

  const commitRead = commitOf(dirname(dirname(dirname(file)))).then(
    (found) => void (commit = found),
    () => undefined,
  );
  const settled = async () => {
    const ended = performance.now();

    await Promise.race([commitRead, delay(COMMIT_WAIT_MS, undefined, { ref: false })]);

    return ended;
  };

  const flush = (exit: number, how: { viaExit?: boolean; ended?: number } = {}) => {
    const { viaExit = false, ended = performance.now() } = how;

    process.off('exit', onExit);

    if (written || recorder.skipped) return;

    written = true;

    const phases = [
      ...recorder.phases,
      ...(recorder.draws.length > 0 ? [{ name: 'draw-queue-wait', ms: Math.round(Math.max(...recorder.draws)) }] : []),
    ];
    const totalMs = Math.round(ended - began);
    const line: TimingLine = {
      command: commandOf(argv),
      args: argv.slice(1),
      parts: partsOf(argv.slice(1)),
      session,
      resident,
      start: start.toISOString(),
      totalMs,
      exit,
      phases,
      queueWaitMs: sumOf(phases, QUEUE_WAIT_PHASES),
      buildWaitMs: sumOf(phases, BUILD_WAIT_PHASES),
      browserStartMs: sumOf(phases, BROWSER_START_PHASES),
      serverStartMs: sumOf(phases, SERVER_START_PHASES),
      cache: recorder.cache,
      concurrentHeavy: recorder.concurrentHeavy,
      commit,
      load: loadOf(),
    };
    const unphasedMs = unphasedMsOf(phases, totalMs);

    if (unphasedMs !== null) line.unphasedMs = unphasedMs;

    const over = overTargetLineOf(line);

    if (over && !viaExit) process.stderr.write(`${over}\n`);

    try {
      write(file, `${JSON.stringify(line)}\n`);
    } catch {
      return;
    }
  };
  const onExit = (code: number) => flush(code, { viaExit: true });

  process.once('exit', onExit);
  current = recorder;

  try {
    const code = await run();

    flush(code, { ended: await settled() });

    return code;
  } catch (error) {
    flush(1, { ended: await settled() });

    throw error;
  } finally {
    current = outer;
  }
};

/**
 * Appends one measured Studio page switch to `file`: `ms` runs from the click until every frame with a stored picture
 * painted. A page `seen` before in the same Studio session is timed against its own target. Returns `null` when the
 * line could not be written.
 */
export const recordPageSwitch = async (options: {
  file: string;
  from: string;
  to: string;
  seen: boolean;
  ms: number;
  painted: boolean;
  start?: Date;
  phases?: TimingPhase[];
  env?: NodeJS.ProcessEnv;
  write?: (file: string, text: string) => void;
  commitOf?: (checkout: string) => Promise<TimingCommit | null>;
  loadOf?: () => TimingLoad;
}) => {
  const {
    file,
    from,
    to,
    seen,
    painted,
    phases = [],
    env = process.env,
    write = defaultWrite,
    commitOf = checkoutCommitOf,
    loadOf = machineLoadOf,
  } = options;
  const totalMs = Math.round(options.ms);
  const commit = await commitOf(dirname(dirname(dirname(file)))).catch(() => null);
  const line: TimingLine = {
    command: seen ? PAGE_SWITCH_COMMAND : FIRST_PAGE_SWITCH_COMMAND,
    args: ['--from', from],
    parts: [to],
    session: sessionOf(env),
    resident: false,
    start: (options.start ?? new Date(Date.now() - totalMs)).toISOString(),
    totalMs,
    exit: painted ? 0 : 1,
    phases,
    queueWaitMs: 0,
    buildWaitMs: 0,
    browserStartMs: 0,
    serverStartMs: 0,
    cache: { hits: 0, misses: 0 },
    concurrentHeavy: null,
    commit,
    load: loadOf(),
  };
  const unphasedMs = unphasedMsOf(phases, totalMs);

  if (unphasedMs !== null) line.unphasedMs = unphasedMs;

  try {
    write(file, `${JSON.stringify(line)}\n`);
  } catch {
    return null;
  }

  return line;
};
