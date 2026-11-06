import { ChildProcess, spawn } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'fs';
import { Server } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { timedPhase } from '../phase-timing';
import { durationOf } from '../wait';
import { harnessBuildKeyOf, harnessInputFilesOf } from './harness-build-cache';
import { restartsWatchBuild } from './harness-inputs';
import { harnessOf } from './harness-map';
import {
  BuildCommandOf,
  freePortOf,
  killGroup,
  NX_BUSY,
  nxBuildCommandOf,
  projectOf,
  serveStatic,
  servingOf,
  stopGroup,
} from './harness-server';
import { HARNESS_PATH } from './part-compare';
import { ResolvedProduct } from './resolve-product';

const WAIT_TIMEOUT_MS = 300_000;
const SETTLE_MS = 1_000;
const SLACK_MS = 50;
const FAILED_LOG_MS = 200;
const POLL_MS = 25;
const OUTPUT_QUIET_MS = 200;

export type WatchLine = 'start' | 'built' | 'failed' | 'busy';

const LINES: [RegExp, WatchLine][] = [
  [NX_BUSY, 'busy'],
  [/Output location: /u, 'built'],
  [/Application bundle generation failed\./u, 'failed'],
  [/(?:❯|>) (?:Building|Changes detected)/u, 'start'],
];

/** What a line of an Angular watch build's output reports, `null` for anything else. */
export const watchLineOf = (line: string): WatchLine | null =>
  LINES.find(([pattern]) => pattern.test(line))?.[1] ?? null;

export type WatchBuild = { startedAt: number; endedAt: number; ok: boolean; log: string[] };

export type WatchState = { last: WatchBuild | null; inFlight: { startedAt: number; prime: boolean } | null };

/**
 * Whether the last finished watch build shows the inputs as they are: no build of a change is running and either no
 * input changed after the last confirmed state, the last build started after the latest change, or the watcher has
 * not reacted to it within `settle` ms, so the change is no input of the build.
 */
export const isWatchBuildCurrent = (options: {
  state: WatchState;
  changedAt: number | null;
  waitingSince: number;
  now: number;
  settle: number;
  slack: number;
}) => {
  const { last, inFlight } = options.state;

  if (!last || (inFlight && !inFlight.prime)) return false;
  if (options.changedAt === null || last.startedAt >= options.changedAt + options.slack) return true;

  return inFlight === null && options.now - Math.max(options.waitingSince, last.endedAt) >= options.settle;
};

/** The latest modification time of an input whose content differs from `confirmed`; `now` for a removed one. */
export const changedAtOf = (options: {
  confirmed: ReadonlyMap<string, string>;
  inputs: ReadonlyMap<string, string>;
  mtimeOf: (path: string) => number | null;
  now: number;
}) => {
  let latest: number | null = null;
  const bump = (at: number) => (latest = latest === null ? at : Math.max(latest, at));

  for (const [path, sha] of options.inputs)
    if (options.confirmed.get(path) !== sha) bump(options.mtimeOf(path) ?? options.now);
  for (const path of options.confirmed.keys()) if (!options.inputs.has(path)) bump(options.now);

  return latest;
};

export const nxWatchCommandOf: BuildCommandOf = (options) => {
  const build = nxBuildCommandOf(options);

  return { command: build.command, args: [...build.args, '--watch', '--outputStyle=stream'] };
};

const entryOf = (target: string, app: string) => {
  try {
    const project = JSON.parse(readFileSync(resolve(target, app, 'project.json'), 'utf8')) as {
      targets?: { build?: { options?: { browser?: unknown; main?: unknown } } };
    };
    const entry = project.targets?.build?.options?.browser ?? project.targets?.build?.options?.main;

    return typeof entry === 'string' ? entry : null;
  } catch {
    return null;
  }
};

const touch = (file: string) => {
  try {
    const now = new Date();

    utimesSync(file, now, now);
  } catch {
    return;
  }
};

const newestChangeOf = (dir: string) => {
  const root = statSync(dir, { throwIfNoEntry: false });

  if (!root) return 0;

  try {
    let newest = root.ctimeMs;

    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true }))
      newest = Math.max(newest, statSync(join(entry.parentPath, entry.name), { throwIfNoEntry: false })?.ctimeMs ?? 0);

    return newest;
  } catch {
    return Date.now();
  }
};

type Watch = {
  key: string;
  app: string;
  wait: (inputs: ReadonlyMap<string, string>) => Promise<{ url: string } | string>;
  dead: () => boolean;
  stop: () => Promise<void>;
};

export const startWatch = (options: {
  target: string;
  root: string;
  app: string;
  project: string;
  key: string;
  inputs: ReadonlyMap<string, string>;
  commandOf: BuildCommandOf;
  settle: number;
  timeout: number;
}): Watch | string => {
  const { target, root, app, project, settle, timeout } = options;
  const task = `${project}:build:development`;
  const dir = mkdtempSync(join(tmpdir(), 'et-design-harness-watch-'));
  const outputPath = join(dir, 'out');
  const spawnedAt = Date.now();
  const state: WatchState = { last: null, inFlight: { startedAt: spawnedAt, prime: false } };
  let confirmed = options.inputs;
  let log: string[] = [];
  let tail = '';
  let ended: 'busy' | 'exited' | null = null;
  let primeArmed = false;
  let server: Server | null = null;
  let url: string | null = null;
  let child: ChildProcess;
  let stopped: Promise<void> | null = null;
  const mtimeOf = (path: string) => statSync(join(root, path), { throwIfNoEntry: false })?.mtimeMs ?? null;

  try {
    const build = options.commandOf({ target, project, outputPath });

    child = spawn(build.command, build.args, {
      cwd: target,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NX_NO_CLOUD: 'true', NX_TUI: 'false', NX_DAEMON: 'false', FORCE_COLOR: '0' },
    });
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });

    return `cannot start ${task}: ${error instanceof Error ? error.message : String(error)}`;
  }

  const killOnExit = () => {
    if (child.pid !== undefined) killGroup(child.pid, 'SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  };

  process.once('exit', killOnExit);

  const prime = () => {
    const entry = entryOf(target, app);
    const changed = [...confirmed.keys()].filter(
      (path) => !restartsWatchBuild(path) && (mtimeOf(path) ?? 0) >= spawnedAt - SLACK_MS,
    );

    for (const path of changed) touch(join(root, path));
    if (entry) touch(resolve(target, entry));

    primeArmed = changed.length === 0 && entry !== null;
  };

  const end = (ok: boolean) => {
    const inFlight = state.inFlight;

    if (!inFlight) return;

    const first = state.last === null;

    state.last = { startedAt: inFlight.startedAt, endedAt: Date.now(), ok, log };
    state.inFlight = null;

    if (first) prime();
  };

  const onLine = (line: string) => {
    tail = `${tail}${line}\n`.slice(-2_000);

    const kind = watchLineOf(line);

    if (kind === 'start') {
      if (state.inFlight) return;

      log = [];
      state.inFlight = { startedAt: Date.now(), prime: primeArmed };
      primeArmed = false;

      return;
    }

    log.push(line);

    if (kind === 'built') end(true);
    if (kind === 'failed') end(false);
    if (kind === 'busy') ended = 'busy';
  };

  let buffered = '';
  const onData = (chunk: Buffer) => {
    const lines = `${buffered}${chunk.toString()}`.split('\n');

    buffered = lines.pop() ?? '';
    lines.forEach(onLine);
  };

  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);
  child.once('error', (error) => {
    tail += `${error.message}\n`;
    ended = 'exited';
  });
  child.once('close', () => (ended ??= 'exited'));

  const stop = () => {
    process.off('exit', killOnExit);
    stopped ??= (async () => {
      if (child.pid !== undefined) await stopGroup(child.pid);
      if (server) {
        const closing = server;
        const closed = new Promise((done) => closing.close(done));

        closing.closeAllConnections();
        await closed;
      }
      rmSync(dir, { recursive: true, force: true });
    })();

    return stopped;
  };

  const served = async (): Promise<{ url: string } | string> => {
    if (url) return { url };

    const browser = join(outputPath, 'browser');
    const port = await freePortOf();
    const started = `http://127.0.0.1:${port}`;

    const serving = await serveStatic(existsSync(browser) ? browser : outputPath, port);

    if (!(await servingOf(started))) {
      await new Promise((done) => serving.close(done));

      return `the ${task} output does not serve ${HARNESS_PATH} on ${started}`;
    }

    server = serving;
    url = started;

    return { url };
  };

  const wait = async (inputs: ReadonlyMap<string, string>): Promise<{ url: string } | string> => {
    const waitingSince = Date.now();

    for (;;) {
      if (ended === 'busy')
        return `${task} waits for another nx process running the same task - wait for it to finish, or pass --url <app dev server url>:\n${tail.trim()}`;
      if (ended === 'exited') return `${task} stopped:\n${tail.trim()}`;

      const now = Date.now();
      const changedAt = changedAtOf({ confirmed, inputs, mtimeOf, now });

      if (isWatchBuildCurrent({ state, changedAt, waitingSince, now, settle, slack: SLACK_MS }) && state.last) {
        confirmed = inputs;

        if (!state.last.ok && now - state.last.endedAt < FAILED_LOG_MS) {
          await delay(POLL_MS);
          continue;
        }
        if (!state.last.ok) return `${task} failed:\n${state.last.log.join('\n').slice(-2_000).trim()}`;
        // Angular logs the output location just before it writes the files.
        if (now - Math.max(state.last.endedAt, newestChangeOf(outputPath)) < OUTPUT_QUIET_MS) {
          await delay(POLL_MS);
          continue;
        }

        try {
          return await served();
        } catch (error) {
          return `cannot serve the ${task} output: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      if (now - waitingSince > timeout) return `${task} did not finish in ${durationOf(timeout)}:\n${tail.trim()}`;

      await delay(POLL_MS);
    }
  };

  return { key: options.key, app, wait, dead: () => ended !== null, stop };
};

export type HarnessWatch = {
  current: (product: ResolvedProduct) => Promise<{ url: string } | string | null>;
  stop: () => Promise<void>;
};

/**
 * Keeps the harness app of the requested product built by an incremental watch build and serves its output. `current`
 * resolves once the build shows the inputs as they are now, with the URL or the build error, or `null` when the
 * checkout has no git state to watch; a changed config, root file, dot-folder input or install restarts the build.
 */
export const createHarnessWatch = (options: {
  target: string;
  commandOf?: BuildCommandOf;
  settle?: number;
  timeout?: number;
}): HarnessWatch => {
  const { target } = options;
  const commandOf = options.commandOf ?? nxWatchCommandOf;
  let watch: Watch | null = null;

  const stop = async () => {
    const stopping = watch;

    watch = null;
    await stopping?.stop();
  };

  const current = async (product: ResolvedProduct) => {
    const harness = harnessOf(product);

    if (harness === null)
      return `product "${product.name}" has no harness in config.json - pass --url <app dev server url>`;
    if (typeof harness === 'string') return harness;

    const found = projectOf(target, harness.app);

    if (typeof found === 'string') return found;

    const inputs = timedPhase('harness-inputs', () => harnessInputFilesOf({ target, app: harness.app }));

    if (!inputs) return null;

    const command = commandOf({ target, project: found.name, outputPath: '<out>' });
    const key = harnessBuildKeyOf({
      target,
      app: harness.app,
      command: [command.command, ...command.args],
      inputs,
      only: restartsWatchBuild,
    });

    if (key === null) return null;
    if (watch && (watch.key !== key || watch.app !== harness.app || watch.dead())) {
      console.error(`restarting the ${found.name} watch build`);
      await stop();
    }

    if (!watch) {
      const started = startWatch({
        target,
        root: inputs.root,
        app: harness.app,
        project: found.name,
        key,
        inputs: inputs.files,
        commandOf,
        settle: options.settle ?? SETTLE_MS,
        timeout: options.timeout ?? WAIT_TIMEOUT_MS,
      });

      if (typeof started === 'string') return started;

      console.error(`watch-building ${found.name}:build:development for the harness app`);
      watch = started;
    }

    const running = watch;
    const result = await timedPhase('harness-watch-wait', () => running.wait(inputs.files));

    if (typeof result === 'string' && running.dead()) await stop();

    return result;
  };

  return { current, stop };
};
