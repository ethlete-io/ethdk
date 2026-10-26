import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

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

export type TypecheckResult =
  { kind: 'ok' } | { kind: 'unavailable'; message: string } | { kind: 'failed'; output: string };

/** Runs `tsc --noEmit -p <tsconfig>` from the checkout. */
export const typecheck = (options: { target: string; tsconfig: string }): TypecheckResult => {
  const { target, tsconfig } = options;
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

  const command = native
    ? { file: 'npx', args: ['-y', native, '--noEmit', '-p', tsconfig] }
    : { file: process.execPath, args: [tsc as string, '--noEmit', '-p', tsconfig] };

  try {
    execFileSync(command.file, command.args, { cwd: target, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    return { kind: 'failed', output: outputOf(error) };
  }

  return { kind: 'ok' };
};
