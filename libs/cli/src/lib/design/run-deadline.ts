import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { tap, timer } from 'rxjs';
import { phasesSoFar } from './timings';

/** The hard deadline of each design command that drives a browser. */
export const RUN_DEADLINES_MS: Readonly<Record<string, number>> = { shot: 5 * 60_000, check: 20 * 60_000 };

export const DEADLINE_EXIT_CODE = 124;

const KEPT_LINES = 200;

let step: string | null = null;

/** Names what the run in progress does now; a run that passes its deadline writes it into its log. */
export const noteStep = (text: string) => {
  step = text;
};

/** The deadline of `command` in ms, or null when it has none. `ETHLETE_DESIGN_DEADLINE_MS` overrides it. */
export const deadlineMsOf = (command: string, env: NodeJS.ProcessEnv = process.env) => {
  const base = RUN_DEADLINES_MS[command];

  if (base === undefined) return null;

  const forced = Number(env['ETHLETE_DESIGN_DEADLINE_MS']);

  return forced > 0 ? forced : base;
};

/** Where deadline logs go: `$ETHLETE_DESIGN_STATE_DIR/deadline`, else `<tmpdir>/et-design/deadline`. */
export const deadlineLogDirOf = (env: NodeJS.ProcessEnv = process.env) =>
  join(env['ETHLETE_DESIGN_STATE_DIR'] || join(tmpdir(), 'et-design'), 'deadline');

const textOf = (chunk: unknown) =>
  typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? Buffer.from(chunk).toString('utf8') : '';

/**
 * Runs `run` and ends the process with `DEADLINE_EXIT_CODE` when it is still running after `ms`, with a log of the
 * last noted step, the phases it ended and its last output; the log's path goes to stderr. A null `ms` runs without one.
 */
export const withRunDeadline = async (
  options: { argv: string[]; ms: number | null; logDir?: string; exit?: (code: number) => void },
  run: () => Promise<number>,
): Promise<number> => {
  const { argv, ms } = options;

  if (ms === null) return run();

  const exit = options.exit ?? ((code: number) => process.exit(code));
  const lines: string[] = [''];
  const keep = (chunk: unknown) => {
    const [first = '', ...rest] = textOf(chunk).split('\n');

    lines[lines.length - 1] += first;
    lines.push(...rest);
    lines.splice(0, Math.max(0, lines.length - KEPT_LINES));
  };
  const streams = [process.stdout, process.stderr];
  const writes = streams.map((stream) => stream.write);
  const restore = () => streams.forEach((stream, index) => (stream.write = writes[index] as typeof stream.write));

  streams.forEach((stream, index) => {
    const write = writes[index] as typeof stream.write;

    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      keep(chunk);

      return (write as (...args: unknown[]) => boolean).call(stream, chunk, ...rest);
    }) as typeof stream.write;
  });

  const began = new Date();

  step = null;

  const pass = () => {
    restore();

    const dir = options.logDir ?? deadlineLogDirOf();
    const file = join(dir, `${argv[0] ?? 'design'}-${began.toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`);
    const log = [
      `design ${argv.join(' ')} passed its deadline of ${Math.round(ms / 1000)} s`,
      `pid ${process.pid}, started ${began.toISOString()}, ended ${new Date().toISOString()}`,
      `last step: ${step ?? 'none noted'}`,
      'ended phases:',
      ...phasesSoFar().map(({ name, ms: took, at }) => `  ${name} ${took} ms${at === undefined ? '' : ` at ${at} ms`}`),
      `last output (${lines.length} lines):`,
      ...lines,
    ].join('\n');

    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, `${log}\n`);
      process.stderr.write(
        `design-explore: \`${argv[0]}\` passed its deadline of ${Math.round(ms / 1000)} s; log: ${file}\n`,
      );
    } catch (error) {
      process.stderr.write(
        `design-explore: \`${argv[0]}\` passed its deadline; the log failed: ${String(error)}\n${log}\n`,
      );
    }

    exit(DEADLINE_EXIT_CODE);
  };
  const deadline = timer(ms).pipe(tap(pass)).subscribe();

  try {
    return await run();
  } finally {
    deadline.unsubscribe();
    restore();
  }
};
