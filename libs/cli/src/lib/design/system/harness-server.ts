import { ChildProcess, spawn } from 'child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { createServer as createHttpServer, Server } from 'http';
import { createRequire } from 'module';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { extname, join, resolve, sep } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { harnessOf } from './harness-map';
import { HARNESS_PATH } from './part-compare';
import { ResolvedProduct } from './resolve-product';

export const RESERVED_PORTS: readonly number[] = [4221, 4400, 4402, 4403, 4492];

const BUILD_TIMEOUT_MS = 300_000;
const STOP_TIMEOUT_MS = 10_000;

export type HarnessServer = { url: string; stop: () => Promise<void> };

export type StartHarnessServer = (options: {
  target: string;
  product: ResolvedProduct;
}) => Promise<HarnessServer | string>;

export type BuildCommandOf = (options: { target: string; project: string; outputPath: string }) => {
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

const NX_BUSY = /Waiting for \S+ in another nx process/;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export const nxBuildCommandOf: BuildCommandOf = ({ target, project, outputPath }) => ({
  command: process.execPath,
  args: [
    createRequire(resolve(target, 'package.json')).resolve('nx/bin/nx'),
    'run',
    `${project}:build:development`,
    `--outputPath=${outputPath}`,
    '--excludeTaskDependencies',
    '--skipNxCache',
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
  if (!project.targets?.['build']) return `${app}/project.json has no build target`;

  return { name: project.name };
};

const servingOf = async (url: string) => {
  try {
    return (await fetch(`${url}${HARNESS_PATH}`, { signal: AbortSignal.timeout(5_000) })).ok;
  } catch {
    return false;
  }
};

const fileOf = (root: string, url: string | undefined) => {
  try {
    const file = resolve(root, `.${decodeURIComponent(new URL(url ?? '/', 'http://local').pathname)}`);

    if (file.startsWith(root + sep) && statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
  } catch {
    return join(root, 'index.html');
  }

  return join(root, 'index.html');
};

const serveStatic = (root: string, port: number) =>
  new Promise<Server>((done, fail) => {
    const server = createHttpServer((request, response) => {
      const file = fileOf(root, request.url);

      response.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
      createReadStream(file)
        .on('error', () => response.writeHead(404).end())
        .pipe(response);
    });

    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => done(server));
  });

type BuildEnd = 'built' | 'failed' | 'busy' | 'timeout';

/**
 * Builds the product's harness app in development mode into a temp folder and serves it on a free port, answering
 * unknown paths with its index.html. The caller must `stop` it.
 */
export const startHarnessServer = async (options: {
  target: string;
  product: ResolvedProduct;
  commandOf?: BuildCommandOf;
  timeout?: number;
}): Promise<HarnessServer | string> => {
  const { target, product } = options;
  const harness = harnessOf(product);

  if (harness === null)
    return `product "${product.name}" has no harness in config.json - pass --url <app dev server url>`;
  if (typeof harness === 'string') return harness;

  const found = projectOf(target, harness.app);

  if (typeof found === 'string') return found;

  const task = `${found.name}:build:development`;
  const dir = mkdtempSync(join(tmpdir(), 'et-design-harness-'));
  const outputPath = join(dir, 'out');
  let child: ChildProcess | null = null;
  let server: Server | null = null;
  let stopped: Promise<void> | null = null;
  const removeDir = () => rmSync(dir, { recursive: true, force: true });
  const killOnExit = () => {
    if (child?.pid !== undefined) killGroup(child.pid, 'SIGKILL');
    removeDir();
  };
  const stop = () => {
    process.off('exit', killOnExit);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    stopped ??= (async () => {
      if (child?.pid !== undefined) await stopGroup(child.pid);
      if (server) {
        const closed = new Promise((done) => server?.close(done));

        server.closeAllConnections();
        await closed;
      }
      removeDir();
    })();

    return stopped;
  };
  const interrupt = (signal: NodeJS.Signals) => void stop().then(() => process.exit(signal === 'SIGINT' ? 130 : 143));

  process.once('exit', killOnExit);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);

  let build: ReturnType<BuildCommandOf>;

  try {
    build = (options.commandOf ?? nxBuildCommandOf)({ target, project: found.name, outputPath });
  } catch (error) {
    await stop();

    return `cannot start ${task}: ${messageOf(error)}`;
  }

  const spawned = spawn(build.command, build.args, {
    cwd: target,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_TUI: 'false', NX_DAEMON: 'false', FORCE_COLOR: '0' },
  });

  child = spawned;

  let tail = '';
  const timer = new AbortController();
  const ended = await Promise.race([
    new Promise<BuildEnd | Error>((done) => {
      const keep = (chunk: Buffer) => {
        tail = (tail + chunk.toString()).slice(-2_000);

        if (NX_BUSY.test(tail)) done('busy');
      };

      spawned.stdout?.on('data', keep);
      spawned.stderr?.on('data', keep);
      spawned.once('error', done);
      spawned.once('close', (code) => done(code === 0 ? 'built' : 'failed'));
    }),
    delay(options.timeout ?? BUILD_TIMEOUT_MS, 'timeout' as const, { signal: timer.signal }).catch(
      () => 'timeout' as const,
    ),
  ]);

  timer.abort();

  if (ended !== 'built') {
    await stop();

    if (ended instanceof Error) return `cannot start ${task}: ${ended.message}`;
    if (ended === 'busy')
      return `${task} waits for another nx process running the same task - wait for it to finish, or pass --url <app dev server url>:\n${tail.trim()}`;

    return `${task} ${ended === 'failed' ? 'failed' : `did not finish in ${Math.round((options.timeout ?? BUILD_TIMEOUT_MS) / 1000)} s`}:\n${tail.trim()}`;
  }

  const browser = join(outputPath, 'browser');
  const root = existsSync(browser) ? browser : outputPath;
  const port = await freePortOf();
  const url = `http://127.0.0.1:${port}`;

  try {
    server = await serveStatic(root, port);
  } catch (error) {
    await stop();

    return `cannot serve the ${task} output on ${url}: ${messageOf(error)}`;
  }

  if (!(await servingOf(url))) {
    await stop();

    return `the ${task} output does not serve ${HARNESS_PATH} on ${url}`;
  }

  return { url, stop };
};

/** Runs `run` with `url`, or without one with the URL of a harness server it starts and always stops afterwards. */
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
