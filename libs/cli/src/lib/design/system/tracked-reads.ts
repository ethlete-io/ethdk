import { Dirent, PathLike } from 'fs';
import { syncBuiltinESMExports } from 'module';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

/** A file system input a tracked run read: the stat of a path, or the listing of a folder. */
export type TrackedInput = { kind: 'stat'; path: string } | { kind: 'list'; path: string; recursive: boolean };

export type PrintedInput = { input: TrackedInput; print: string };

type Fs = typeof import('fs');

const fs = process.getBuiltinModule('fs') as Fs;

/** The `fs` functions a tracked run records by the path they get, as a stat or a folder listing. */
export const STAT_READS = [
  'readFileSync',
  'existsSync',
  'statSync',
  'lstatSync',
  'accessSync',
  'realpathSync',
  'openSync',
  'readlinkSync',
] as const;

export const LIST_READS = ['readdirSync', 'opendirSync'] as const;

const pathOf = (path: unknown) => {
  if (typeof path === 'string') return resolve(path);
  if (Buffer.isBuffer(path)) return resolve(path.toString());
  if (path instanceof URL) return path.protocol === 'file:' ? fileURLToPath(path) : null;

  return null;
};

const statPrintOf = (path: string) => {
  const stat = fs.statSync(path, { bigint: true, throwIfNoEntry: false });

  return stat ? `${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}:${stat.ino}` : 'missing';
};

const listPrintOf = (path: string, recursive: boolean) => {
  try {
    return (fs.readdirSync(path, { recursive, withFileTypes: true }) as Dirent[])
      .map((entry) => `${entry.parentPath}/${entry.name}:${entry.isDirectory() ? 'd' : 'f'}`)
      .sort()
      .join('\n');
  } catch {
    return 'missing';
  }
};

export const printOf = (input: TrackedInput) =>
  input.kind === 'stat' ? statPrintOf(input.path) : listPrintOf(input.path, input.recursive);

/** Whether every input still prints what it printed when the run read it; a vanished file prints differently. */
export const inputsUnchanged = (inputs: PrintedInput[]) => inputs.every(({ input, print }) => printOf(input) === print);

let recording: ((input: TrackedInput) => void) | null = null;
let installed = false;

const installRecorders = () => {
  if (installed) return;

  const target = fs as unknown as Record<string, (...args: unknown[]) => unknown>;

  for (const name of STAT_READS) {
    const original = target[name];

    if (!original) continue;
    target[name] = Object.assign(
      (path: unknown, ...rest: unknown[]) => {
        const resolved = recording ? pathOf(path) : null;

        if (resolved) recording?.({ kind: 'stat', path: resolved });

        return original.call(fs, path, ...rest);
      },
      { native: (original as { native?: unknown }).native },
    );
  }
  for (const name of LIST_READS) {
    const original = target[name];

    if (!original) continue;
    target[name] = (path: unknown, options?: unknown) => {
      const resolved = recording ? pathOf(path) : null;
      const recursive =
        typeof options === 'object' && options !== null && (options as { recursive?: boolean }).recursive === true;

      if (resolved) recording?.({ kind: 'list', path: resolved, recursive });

      return original.call(fs, path as PathLike, options);
    };
  }
  syncBuiltinESMExports();
  installed = true;
};

/**
 * Runs the synchronous `run` with every `fs` read in `STAT_READS` and `LIST_READS` recorded, and returns its value with
 * what each input printed. `run` must not await: the tracking ends when it returns.
 */
export const trackedRun = <T>(run: () => T): { value: T; inputs: PrintedInput[] } => {
  const seen = new Map<string, TrackedInput>();

  // The recorders stay installed once a run needs them: a loader such as jiti keeps the `fs` function a module first
  // called, so a recorder put back after one run would record nothing in the next.
  installRecorders();
  recording = (input) => seen.set(JSON.stringify(input), input);

  try {
    const value = run();

    return { value, inputs: [...seen.values()].map((input) => ({ input, print: printOf(input) })) };
  } finally {
    recording = null;
  }
};
