import { SpawnSyncOptions, SpawnSyncReturns, spawnSync } from 'child_process';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, 'gu');

type PlainOptions = Omit<SpawnSyncOptions, 'encoding' | 'stdio'> & { stdio?: 'pipe' };

export const stripAnsi = (text: string) => text.replace(ANSI, '');

/** An environment under which a child process prints no colour, even when the parent has `FORCE_COLOR` set. */
export const plainEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  const { FORCE_COLOR: _forced, ...rest } = env;

  return { ...rest, NO_COLOR: '1', FORCE_COLOR: '0' };
};

/**
 * Runs `[command, ...args]` and captures its output as plain text: no colour requested from the child,
 * and any ANSI it prints anyway removed from `stdout` and `stderr`. Pass `--pretty false` to `tsc` yourself.
 */
export const spawnPlain = (
  [command = '', ...args]: readonly string[],
  options: PlainOptions = {},
): SpawnSyncReturns<string> => {
  const result = spawnSync(command, args, { ...options, env: plainEnv(options.env), encoding: 'utf8' });

  return { ...result, stdout: stripAnsi(result.stdout ?? ''), stderr: stripAnsi(result.stderr ?? '') };
};

/** `spawnPlain` that returns stdout and throws, with plain `stdout`/`stderr` on the error, when the process fails. */
export const execPlain = (argv: readonly string[], options: PlainOptions = {}) => {
  const result = spawnPlain(argv, options);

  if (result.error || result.status !== 0)
    throw Object.assign(result.error ?? new Error(`Command failed: ${argv.join(' ')}`), {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
    });

  return result.stdout;
};
