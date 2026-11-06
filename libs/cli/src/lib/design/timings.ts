import { appendFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

export const TIMINGS_FILE = '.ethlete/design/.timings.jsonl';

export const BUILD_WAIT_PHASES = ['lib-build-wait', 'harness-build', 'harness-watch-wait'];
export const BROWSER_START_PHASES = ['browser-start'];
export const SERVER_START_PHASES = ['compare-design-server'];
export const QUEUE_WAIT_PHASES = ['resident-queue-wait', 'draw-queue-wait'];

export type TimingSession = { claude: string | null; tmux: string | null; role: string | null };

export type TimingPhase = { name: string; ms: number };

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
};

type Recorder = {
  phases: TimingPhase[];
  draws: number[];
  cache: { hits: number; misses: number };
  concurrentHeavy: number | null;
  skipped: boolean;
};

let current: Recorder | null = null;

export const timingsFileOf = (target: string) => join(target, TIMINGS_FILE);

export const recordPhase = (name: string, ms: number) => void current?.phases.push({ name, ms: Math.round(ms) });

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

const sumOf = (phases: TimingPhase[], names: string[]) =>
  phases.filter((phase) => names.includes(phase.name)).reduce((total, phase) => total + phase.ms, 0);

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
  },
  run: () => Promise<number>,
): Promise<number> => {
  const { file, argv, resident = false, env = process.env, write = defaultWrite } = options;
  const recorder: Recorder = {
    phases: [],
    draws: [],
    cache: { hits: 0, misses: 0 },
    concurrentHeavy: null,
    skipped: false,
  };
  const outer = current;
  const start = new Date();
  const began = performance.now();
  const session = sessionOf(env);
  let written = false;

  const flush = (exit: number) => {
    process.off('exit', onExit);

    if (written || recorder.skipped) return;

    written = true;

    const phases = [
      ...recorder.phases,
      ...(recorder.draws.length > 0 ? [{ name: 'draw-queue-wait', ms: Math.round(Math.max(...recorder.draws)) }] : []),
    ];
    const line: TimingLine = {
      command: commandOf(argv),
      args: argv.slice(1),
      parts: partsOf(argv.slice(1)),
      session,
      resident,
      start: start.toISOString(),
      totalMs: Math.round(performance.now() - began),
      exit,
      phases,
      queueWaitMs: sumOf(phases, QUEUE_WAIT_PHASES),
      buildWaitMs: sumOf(phases, BUILD_WAIT_PHASES),
      browserStartMs: sumOf(phases, BROWSER_START_PHASES),
      serverStartMs: sumOf(phases, SERVER_START_PHASES),
      cache: recorder.cache,
      concurrentHeavy: recorder.concurrentHeavy,
    };

    try {
      write(file, `${JSON.stringify(line)}\n`);
    } catch {
      return;
    }
  };
  const onExit = (code: number) => flush(code);

  process.once('exit', onExit);
  current = recorder;

  try {
    const code = await run();

    flush(code);

    return code;
  } catch (error) {
    flush(1);

    throw error;
  } finally {
    current = outer;
  }
};
