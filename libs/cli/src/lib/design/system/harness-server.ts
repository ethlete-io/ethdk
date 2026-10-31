import { ChildProcess, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { createServer } from 'net';
import { resolve } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { harnessOf } from './harness-map';
import { HARNESS_PATH } from './part-compare';
import { ResolvedProduct } from './resolve-product';

export const RESERVED_PORTS: readonly number[] = [4221, 4400, 4402, 4403, 4492];

const READY_TIMEOUT_MS = 300_000;
const STOP_TIMEOUT_MS = 10_000;

export type HarnessServer = { url: string; stop: () => Promise<void> };

export type StartHarnessServer = (options: {
  target: string;
  product: ResolvedProduct;
}) => Promise<HarnessServer | string>;

export type ServeCommandOf = (options: { target: string; project: string; port: number }) => {
  command: string;
  args: string[];
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const ephemeralPort = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();

    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      server.close(() => (typeof address === 'object' && address ? done(address.port) : fail(new Error('no port'))));
    });
  });

/** A free local port the OS hands out, never one of the `RESERVED_PORTS` the user's own servers use. */
export const freePortOf = async (probe: () => Promise<number> = ephemeralPort) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = await probe();

    if (!RESERVED_PORTS.includes(port)) return port;
  }

  throw new Error(`no free port outside ${RESERVED_PORTS.join(', ')}`);
};

export const nxServeCommandOf: ServeCommandOf = ({ target, project, port }) => ({
  command: process.execPath,
  args: [
    createRequire(resolve(target, 'package.json')).resolve('nx/bin/nx'),
    'run',
    `${project}:serve`,
    `--port=${port}`,
    '--host=127.0.0.1',
  ],
});

const groupAlive = (pid: number) => {
  try {
    process.kill(-pid, 0);

    return true;
  } catch {
    return false;
  }
};

const killGroup = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pid, signal);
  } catch {
    return;
  }
};

const stopGroup = async (pid: number) => {
  killGroup(pid, 'SIGTERM');

  const until = Date.now() + STOP_TIMEOUT_MS;

  while (groupAlive(pid) && Date.now() < until) await delay(100);

  killGroup(pid, 'SIGKILL');
};

const projectOf = (target: string, app: string) => {
  const file = resolve(target, app, 'project.json');

  if (!existsSync(file)) return `the harness app ${app} has no project.json`;

  const project = JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown; targets?: Record<string, unknown> };

  if (typeof project.name !== 'string') return `${app}/project.json names no project`;
  if (!project.targets?.['serve']) return `${app}/project.json has no serve target`;

  return { name: project.name };
};

const servingOf = async (url: string) => {
  try {
    return (await fetch(`${url}${HARNESS_PATH}`, { signal: AbortSignal.timeout(5_000) })).ok;
  } catch {
    return false;
  }
};

/**
 * Starts the dev server of the product's harness app on a free port and resolves once it serves the harness route.
 * The caller must `stop` it.
 */
export const startHarnessServer = async (options: {
  target: string;
  product: ResolvedProduct;
  commandOf?: ServeCommandOf;
  timeout?: number;
}): Promise<HarnessServer | string> => {
  const { target, product } = options;
  const harness = harnessOf(product);

  if (harness === null)
    return `product "${product.name}" has no harness in config.json - pass --url <app dev server url>`;
  if (typeof harness === 'string') return harness;

  const found = projectOf(target, harness.app);

  if (typeof found === 'string') return found;

  const project = found.name;
  const port = await freePortOf();
  const url = `http://127.0.0.1:${port}`;
  let serve: ReturnType<ServeCommandOf>;

  try {
    serve = (options.commandOf ?? nxServeCommandOf)({ target, project, port });
  } catch (error) {
    return `cannot start ${project}:serve: ${messageOf(error)}`;
  }

  const { command, args } = serve;
  const child: ChildProcess = spawn(command, args, {
    cwd: target,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_TUI: 'false', FORCE_COLOR: '0' },
  });
  const pid = child.pid;
  let tail = '';
  let exited = false;
  const keep = (chunk: Buffer) => void (tail = (tail + chunk.toString()).slice(-2_000));

  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.once('exit', () => (exited = true));

  if (pid === undefined) {
    const error = await new Promise((done) => child.once('error', done));

    return `cannot start ${project}:serve: ${messageOf(error)}`;
  }

  const killOnExit = () => killGroup(pid, 'SIGKILL');
  let stopped: Promise<void> | null = null;
  const stop = () => {
    process.off('exit', killOnExit);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    stopped ??= stopGroup(pid);

    return stopped;
  };
  const interrupt = (signal: NodeJS.Signals) => void stop().then(() => process.exit(signal === 'SIGINT' ? 130 : 143));

  process.once('exit', killOnExit);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const until = Date.now() + (options.timeout ?? READY_TIMEOUT_MS);

  while (!(await servingOf(url))) {
    if (exited || Date.now() > until) {
      await stop();

      return `${project}:serve ${exited ? 'exited' : `did not serve ${HARNESS_PATH} in time`} on ${url}:\n${tail.trim()}`;
    }

    await delay(500);
  }

  return { url, stop };
};

/** Runs `run` with `url`, or without one with the URL of a harness dev server it starts and always stops afterwards. */
export const withHarnessUrl = async <T>(options: {
  target: string;
  product: ResolvedProduct;
  url: string | undefined;
  start?: StartHarnessServer;
  run: (url: string) => Promise<T>;
}): Promise<T | string> => {
  if (options.url) return options.run(options.url);

  const server = await (options.start ?? startHarnessServer)({ target: options.target, product: options.product });

  if (typeof server === 'string') return server;

  console.log(`started the harness app on ${server.url}`);

  try {
    return await options.run(server.url);
  } finally {
    await server.stop();
  }
};
