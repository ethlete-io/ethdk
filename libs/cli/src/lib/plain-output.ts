import { spawn, SpawnSyncOptions, SpawnSyncReturns, spawnSync } from 'child_process';

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

export type PlainResult = { status: number | null; stdout: string; stderr: string; error?: Error };

/** `spawnPlain` that does not block the event loop; `input` goes to the child's stdin. */
export const spawnPlainAsync = (
  [command = '', ...args]: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string } = {},
) =>
  new Promise<PlainResult>((done) => {
    const child = spawn(command, args, { cwd: options.cwd, env: plainEnv(options.env), stdio: 'pipe' });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const text = (chunks: Buffer[]) => stripAnsi(Buffer.concat(chunks).toString('utf8'));

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => done({ status: null, stdout: text(stdout), stderr: text(stderr), error }));
    child.on('close', (status) => done({ status, stdout: text(stdout), stderr: text(stderr) }));
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.input ?? '');
  });

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
