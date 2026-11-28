import { spawn } from 'child_process';
import { FSWatcher, readdirSync, watch } from 'fs';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';

/** The exit code a supervised server ends with to be started again from the current build. */
export const RELOAD_EXIT_CODE = 75;

export const SUPERVISED_ENV = 'ETHLETE_DESIGN_SUPERVISED';

const directoriesUnder = (root: string) => {
  try {
    const nested = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(entry.parentPath, entry.name));

    return [root, ...nested];
  } catch {
    return [];
  }
};

/**
 * Calls `onRebuild` once the package under `root` has stopped changing for `settleMs` and `stampOf`
 * no longer returns `served`, so a rewrite of the same build reloads nothing.
 */
export const watchBuild = (options: {
  root: string;
  served: string;
  stampOf: () => string;
  onRebuild: () => void;
  settleMs?: number;
}) => {
  const { root, served, stampOf, onRebuild, settleMs = 1000 } = options;
  // Node's recursive watch on Linux loses a file once a build renames another over it, so every directory gets its own.
  const watchers = new Map<string, FSWatcher>();
  let settling: AbortController | undefined;
  let closed = false;

  const settle = () => {
    if (closed) return;
    settling?.abort();
    settling = new AbortController();
    void delay(settleMs, undefined, { signal: settling.signal, ref: false }).then(check, () => undefined);
  };

  const unwatch = (dir: string) => {
    watchers.get(dir)?.close();
    watchers.delete(dir);
  };

  const sync = () => {
    const dirs = new Set(directoriesUnder(root));

    for (const dir of watchers.keys()) if (!dirs.has(dir)) unwatch(dir);

    for (const dir of dirs) {
      if (watchers.has(dir)) continue;

      try {
        const watcher = watch(dir, settle);

        watcher.unref();
        watcher.on('error', () => {
          unwatch(dir);
          settle();
        });
        watchers.set(dir, watcher);
      } catch {
        settle();
      }
    }

    return dirs.size > 0;
  };

  const check = () => {
    if (closed) return;

    let stamp: string;

    try {
      if (!sync()) throw new Error(`${root} is missing`);
      stamp = stampOf();
    } catch {
      settle();

      return;
    }

    if (stamp === served) return;

    close();
    onRebuild();
  };

  const close = () => {
    closed = true;
    for (const dir of [...watchers.keys()]) unwatch(dir);
    settling?.abort();
  };

  if (!sync()) settle();

  return { close };
};

/**
 * Runs `launch` until it ends with anything but `RELOAD_EXIT_CODE`, and returns that code. The
 * process that supervises stays the one its parent started, so Studio keeps tracking it.
 */
export const superviseReloads = async (launch: () => Promise<number>) => {
  for (;;) {
    const code = await launch();

    if (code !== RELOAD_EXIT_CODE) return code;
  }
};

/** Starts this command again as a supervised child on `port`, from `cwd`, and resolves with its exit code. */
export const relaunch = (options: { port: number; cwd: string }) =>
  new Promise<number>((resolveCode) => {
    const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
      cwd: options.cwd,
      stdio: 'inherit',
      env: { ...process.env, DE_PORT: String(options.port), [SUPERVISED_ENV]: '1' },
    });
    const forward = (signal: NodeJS.Signals) => () => child.kill(signal);
    const forwards = (['SIGINT', 'SIGTERM', 'SIGHUP'] as const).map((signal) => {
      const listener = forward(signal);

      process.on(signal, listener);

      return () => process.off(signal, listener);
    });

    child.once('error', () => resolveCode(1));
    child.once('exit', (code, signal) => {
      for (const stop of forwards) stop();
      resolveCode(code ?? (signal ? 1 : 0));
    });
  });
