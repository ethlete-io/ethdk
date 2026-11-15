import { AsyncLocalStorage } from 'async_hooks';
import { Dirent } from 'fs';
import { syncBuiltinESMExports } from 'module';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

/** A file system input a tracked run read: the stat of a path, or the listing of a folder. */
export type TrackedInput = { kind: 'stat'; path: string } | { kind: 'list'; path: string; recursive: boolean };

export type PrintedInput = { input: TrackedInput; print: string };

type Fs = typeof import('fs');

const fs = process.getBuiltinModule('fs') as Fs;

const ASYNC_STAT_READS = ['readFile', 'stat', 'lstat', 'access', 'realpath', 'open', 'readlink'] as const;

const ASYNC_LIST_READS = ['readdir', 'opendir'] as const;

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
  'exists',
  ...ASYNC_STAT_READS,
] as const;

export const LIST_READS = ['readdirSync', 'opendirSync', ...ASYNC_LIST_READS] as const;

/** The `fs/promises` functions a tracked run records, as a stat or a folder listing. */
export const PROMISE_STAT_READS = ASYNC_STAT_READS;

export const PROMISE_LIST_READS = ASYNC_LIST_READS;

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

type Recorder = (input: TrackedInput) => void;

const recorders = new AsyncLocalStorage<Recorder | null>();

const recording = () => recorders.getStore() ?? null;

let installed = false;

type Target = Record<string, (...args: unknown[]) => unknown>;

const recordStats = (target: Target, names: readonly string[]) => {
  for (const name of names) {
    const original = target[name];

    if (!original) continue;
    target[name] = Object.assign(
      (path: unknown, ...rest: unknown[]) => {
        const record = recording();
        const resolved = record ? pathOf(path) : null;

        if (resolved) record?.({ kind: 'stat', path: resolved });

        return original.call(target, path, ...rest);
      },
      { native: (original as { native?: unknown }).native },
    );
  }
};

const recordLists = (target: Target, names: readonly string[]) => {
  for (const name of names) {
    const original = target[name];

    if (!original) continue;
    target[name] = (path: unknown, ...rest: unknown[]) => {
      const record = recording();
      const resolved = record ? pathOf(path) : null;
      const options = rest[0];
      const recursive =
        typeof options === 'object' && options !== null && (options as { recursive?: boolean }).recursive === true;

      if (resolved) record?.({ kind: 'list', path: resolved, recursive });

      return original.call(target, path, ...rest);
    };
  }
};

const installRecorders = () => {
  if (installed) return;

  recordStats(fs as unknown as Target, STAT_READS);
  recordLists(fs as unknown as Target, LIST_READS);
  recordStats(fs.promises as unknown as Target, PROMISE_STAT_READS);
  recordLists(fs.promises as unknown as Target, PROMISE_LIST_READS);
  syncBuiltinESMExports();
  installed = true;
};

const recorderOf = (seen: Map<string, TrackedInput>): Recorder => {
  const outer = recording();

  return (input) => {
    seen.set(JSON.stringify(input), input);
    outer?.(input);
  };
};

const printedOf = (seen: Map<string, TrackedInput>) =>
  recorders.run(null, () => [...seen.values()].map((input) => ({ input, print: printOf(input) })));

/**
 * Runs the synchronous `run` with every `fs` read in `STAT_READS` and `LIST_READS` recorded, and returns its value with
 * what each input printed. `run` must not await: the tracking ends when it returns; `trackedRunAsync` awaits.
 */
export const trackedRun = <T>(run: () => T): { value: T; inputs: PrintedInput[] } => {
  const seen = new Map<string, TrackedInput>();

  // The recorders stay installed once a run needs them: a loader such as jiti keeps the `fs` function a module first
  // called, so a recorder put back after one run would record nothing in the next.
  installRecorders();

  const value = recorders.run(recorderOf(seen), run);

  return { value, inputs: printedOf(seen) };
};

/**
 * `trackedRun` for an async `run`: it records the reads of `run` and of the work it awaits, also the `fs/promises` and
 * callback reads, but not the reads of another run at the same time.
 */
export const trackedRunAsync = async <T>(run: () => Promise<T>): Promise<{ value: T; inputs: PrintedInput[] }> => {
  const seen = new Map<string, TrackedInput>();

  installRecorders();

  const value = await recorders.run(recorderOf(seen), run);

  return { value, inputs: printedOf(seen) };
};

/** Runs the synchronous `run` with no read recorded by the tracked runs around the call. */
export const untrackedRun = <T>(run: () => T): T => recorders.run(null, run);

/** Records the inputs of a held value in every tracked run around the call, as if the call had read them again. */
export const recordInputs = (inputs: PrintedInput[]) => {
  const record = recording();

  for (const { input } of inputs) record?.(input);
};

/** The stat inputs of the files another process read, each also recorded by every tracked run around the call. */
export const readInputsOf = (paths: Iterable<string>): PrintedInput[] =>
  [...new Set([...paths].map((path) => resolve(path)))].map((path) => {
    const input: TrackedInput = { kind: 'stat', path };

    recording()?.(input);

    return { input, print: printOf(input) };
  });

/**
 * Wraps a synchronous `run` so a call reuses the value of the last call with the same slot while every file and
 * folder listing that call read still prints the same; a throwing call keeps nothing. The slot names the request, never
 * the files: what was read decides freshness.
 */
export const readsCacheOf = <TArgs, T>(options: { slotOf: (args: TArgs) => string; run: (args: TArgs) => T }) => {
  const entries = new Map<string, { inputs: PrintedInput[]; value: T }>();

  return (args: TArgs): T => {
    const slot = options.slotOf(args);
    const held = entries.get(slot);

    if (held && inputsUnchanged(held.inputs)) return held.value;

    const { value, inputs } = trackedRun(() => options.run(args));

    entries.set(slot, { inputs, value });

    return value;
  };
};

/** `readsCacheOf` for an async `run`; a call while the same slot still runs reads its answer once it ends. */
export const asyncReadsCacheOf = <TArgs, T>(options: {
  slotOf: (args: TArgs) => string;
  run: (args: TArgs) => Promise<T>;
}) => {
  const entries = new Map<string, Promise<{ inputs: PrintedInput[]; value: T }>>();

  return async (args: TArgs): Promise<T> => {
    const slot = options.slotOf(args);
    const held = await entries.get(slot)?.catch(() => null);

    if (held && inputsUnchanged(held.inputs)) {
      recordInputs(held.inputs);

      return held.value;
    }

    const running = trackedRunAsync(() => options.run(args));

    entries.set(slot, running);
    running.catch(() => entries.get(slot) === running && entries.delete(slot));

    return (await running).value;
  };
};
