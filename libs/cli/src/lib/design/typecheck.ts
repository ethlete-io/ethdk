import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { execPlain, spawnPlainAsync } from '../plain-output';

/**
 * A tool the checker shells out to, taken from the checkout first and from this package second, so
 * a checkout that keeps design calls need not install anything of its own. The path comes out of
 * the package's own `bin` field, because an `exports` map hides the file from a direct resolve.
 */
export const binaryOf = (options: { target: string; pkg: string; bin: string }) => {
  const { target, pkg, bin } = options;

  try {
    const manifest = require.resolve(`${pkg}/package.json`, { paths: [target, __dirname] });
    const declared = (JSON.parse(readFileSync(manifest, 'utf8')) as { bin?: string | Record<string, string> }).bin;
    const path = typeof declared === 'string' ? declared : declared?.[bin];

    return path ? resolve(dirname(manifest), path) : null;
  } catch {
    return null;
  }
};

/** A bundler stack runs to hundreds of frames and says nothing. Keep the message. */
export const trim = (text: string) =>
  [...new Set(text.split('\n').filter((line) => !/^\s+at /.test(line) && line.trim() !== ''))].slice(0, 12).join('\n');

export const outputOf = (error: unknown) => {
  const shape = error as { stdout?: string; stderr?: string };

  return trim(`${shape.stdout ?? ''}${shape.stderr ?? ''}`);
};

/** Why a child process failed when it printed nothing: its error, exit code or signal. */
export const processFailureOf = (error: unknown) => {
  const shape = error as { message?: string; code?: string; status?: number | null; signal?: string | null };
  const exit = shape.signal
    ? `signal ${shape.signal}`
    : typeof shape.status === 'number'
      ? `exit code ${shape.status}`
      : shape.code;

  return [exit, shape.message ? trim(shape.message) : null].filter(Boolean).join(' - ') || 'no output';
};

export type TypecheckResult =
  { kind: 'ok' } | { kind: 'unavailable'; message: string } | { kind: 'failed'; output: string };

type TscCommand = { file: string; args: string[] };

type TypecheckOptions = {
  target: string;
  tsconfig: string;
  /** Where `tsc --incremental` keeps its state between runs; without it every run checks from scratch. */
  buildInfo?: string;
};

const tscCommandOf = (options: TypecheckOptions): TscCommand | TypecheckResult => {
  const { target, tsconfig, buildInfo } = options;
  /**
   * `TSC=@typescript/native-preview` runs the Go port, which is about a third faster - but it
   * rejects a `baseUrl` in the config, so a repository that still uses one cannot run it.
   */
  const native = process.env['TSC'];
  const tsc = native ? null : binaryOf({ target, pkg: 'typescript', bin: 'tsc' });

  if (!native && !tsc)
    return {
      kind: 'unavailable',
      message: 'NO TYPE CHECKER - neither the checkout nor this package resolves typescript.',
    };

  const incremental = buildInfo ? ['--incremental', '--tsBuildInfoFile', buildInfo] : [];

  return native
    ? { file: 'npx', args: ['-y', native, '--noEmit', '--pretty', 'false', '-p', tsconfig] }
    : {
        file: process.execPath,
        args: [tsc as string, '--noEmit', '--pretty', 'false', ...incremental, '-p', tsconfig],
      };
};

const failureOf = (command: TscCommand, error: unknown): TypecheckResult => {
  const output = outputOf(error);

  if (output) return { kind: 'failed', output };

  return {
    kind: 'unavailable',
    message: `TYPE CHECKER DID NOT RUN - ${[command.file, ...command.args].join(' ')} printed nothing (${processFailureOf(error)}).`,
  };
};

/** Runs `tsc --noEmit --pretty false -p <tsconfig>` from the checkout. */
export const typecheck = (options: TypecheckOptions): TypecheckResult => {
  const command = tscCommandOf(options);

  if ('kind' in command) return command;

  try {
    execPlain([command.file, ...command.args], { cwd: options.target });
  } catch (error) {
    return failureOf(command, error);
  }

  return { kind: 'ok' };
};

/** `typecheck` in a child process that does not block the event loop. */
export const typecheckAsync = async (options: TypecheckOptions): Promise<TypecheckResult> => {
  const command = tscCommandOf(options);

  if ('kind' in command) return command;

  const result = await spawnPlainAsync([command.file, ...command.args], { cwd: options.target });

  if (result.error || result.status !== 0)
    return failureOf(command, {
      ...result,
      message: result.error?.message,
      code: (result.error as NodeJS.ErrnoException | undefined)?.code,
    });

  return { kind: 'ok' };
};
