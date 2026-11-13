import { spawn } from 'child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'fs';
import { request as httpRequest } from 'http';
import { join, resolve } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { acquireApiLock, releaseApiLock } from '../../api/lock';
import { LIB_READER_ENV } from '../system/lib-build-lock';
import { IsAlive, isAlive, liveDiscoveryOf, removeDiscovery, residentDirOf, Discovery } from './discovery';
import { FORWARDED_ENV, ResidentFrame, ResidentRequest, TOKEN_HEADER } from './server';

/** `ETHLETE_DESIGN_RESIDENT=0` keeps every design call in its own process, as `CI` does. */
export const RESIDENT_ENV = 'ETHLETE_DESIGN_RESIDENT';

/** The hidden `et design` subcommand that runs the resident process. */
export const RESIDENT_SERVE = '__resident';

const DEFAULT_COLD_START_S = 20;

/** Must match MARKER in tools/scripts/scratch-checkout.mjs. */
export const SCRATCH_MARKER = '.scratch-checkout';

export type ResidentClient = {
  build: string;
  env: NodeJS.ProcessEnv;
  alive: IsAlive;
  kill: (pid: number, signal: NodeJS.Signals) => void;
  start: (target: string) => void;
  out: (text: string) => void;
  err: (text: string) => void;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  startTimeoutMs: number;
  pingTimeoutMs: number;
  stopGraceMs: number;
  silenceMs: number;
};

export const residentLogOf = (target: string) => join(residentDirOf(target), 'resident.log');

const startDetached = (target: string) => {
  mkdirSync(residentDirOf(target), { recursive: true });

  const log = openSync(residentLogOf(target), 'w');
  const env = { ...process.env };

  delete env[LIB_READER_ENV];
  FORWARDED_ENV.forEach((key) => delete env[key]);

  spawn(process.execPath, [process.argv[1] ?? '', 'design', RESIDENT_SERVE, '--checkout', target], {
    cwd: target,
    detached: true,
    stdio: ['ignore', log, log],
    env,
  }).unref();
};

export const realResidentClient = (build: string): ResidentClient => ({
  build,
  env: process.env,
  alive: isAlive,
  kill: (pid, signal) => {
    try {
      process.kill(pid, signal);
    } catch {
      return;
    }
  },
  start: startDetached,
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
  now: () => Date.now(),
  sleep: async (ms) => void (await delay(ms)),
  startTimeoutMs: 120_000,
  pingTimeoutMs: 5_000,
  stopGraceMs: 5_000,
  silenceMs: 60_000,
});

const RESIDENT_SKETCH_COMMANDS = new Set(['check', 'ready']);

const CHECK_SCOPES = ['--product', '--part'];

const CHECK_ELSEWHERE = [
  '--app-classes',
  '--rules',
  '--live',
  '--slow',
  '--receipt',
  '--call',
  '--lint',
  '--tsconfig',
  '--variant',
];

const drawsSystem = (argv: string[]) =>
  argv.some((argument) => CHECK_SCOPES.includes(argument)) &&
  !argv.some((argument) => CHECK_ELSEWHERE.includes(argument));

/**
 * Whether `et design <argv>` runs in the resident design process: compare, shot (not an asset shot), check of a
 * product or part (not its source-only modes), sketch check and sketch ready.
 */
export const runsInResident = (argv: string[]) =>
  argv[0] === 'compare' ||
  (argv[0] === 'shot' && !argv.includes('--asset')) ||
  (argv[0] === 'check' && drawsSystem(argv.slice(1))) ||
  (argv[0] === 'sketch' && RESIDENT_SKETCH_COMMANDS.has(argv[1] ?? ''));

export const residentWanted = (env: NodeJS.ProcessEnv) => !env['CI'] && env[RESIDENT_ENV] !== '0';

/** Whether `design serve` hosts the resident of its checkout, so both share one design server and one Chromium. */
export const sharedServeWanted = (env: NodeJS.ProcessEnv) => env[RESIDENT_ENV] !== '0';

const servedBy = (found: Discovery) => found.owner === 'serve';

const call = (options: {
  found: Discovery;
  method: 'GET' | 'POST';
  path: string;
  timeoutMs: number;
}): Promise<string | null> =>
  new Promise((done) => {
    const { found, method, path, timeoutMs } = options;
    const asked = httpRequest(
      { host: '127.0.0.1', port: found.port, method, path, headers: { [TOKEN_HEADER]: found.token } },
      (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.once('end', () => done(response.statusCode === 200 ? body : null));
        response.once('error', () => done(null));
      },
    );

    asked.setTimeout(timeoutMs, () => asked.destroy());
    asked.once('error', () => done(null));
    asked.end();
  });

const answers = async (found: Discovery, client: ResidentClient) => {
  const body = await call({ found, method: 'GET', path: '/ping', timeoutMs: client.pingTimeoutMs });

  try {
    return body !== null && (JSON.parse(body) as { pid?: unknown }).pid === found.pid;
  } catch {
    return false;
  }
};

const fits = ({ found, target, client }: { found: Discovery; target: string; client: ResidentClient }) =>
  found.checkout === resolve(target) && found.build === client.build;

const stopProcess = async ({ found, target, client }: { found: Discovery; target: string; client: ResidentClient }) => {
  await call({ found, method: 'POST', path: '/stop', timeoutMs: client.pingTimeoutMs });

  const until = client.now() + client.stopGraceMs;

  while (client.alive(found.pid) && client.now() < until) await client.sleep(100);

  if (client.alive(found.pid)) client.kill(found.pid, 'SIGKILL');

  removeDiscovery(target, found.pid);
};

const coldStartFileOf = (target: string) => join(residentDirOf(target), 'cold-start.json');

const coldStartOf = (target: string) => {
  try {
    const { seconds } = JSON.parse(readFileSync(coldStartFileOf(target), 'utf8')) as { seconds?: unknown };

    return typeof seconds === 'number' ? seconds : DEFAULT_COLD_START_S;
  } catch {
    return DEFAULT_COLD_START_S;
  }
};

const startResident = async (target: string, client: ResidentClient): Promise<Discovery | string> => {
  client.err(`starting the resident design process (cold start, ~${coldStartOf(target)} s)\n`);

  const began = client.now();

  client.start(target);

  while (client.now() - began < client.startTimeoutMs) {
    await client.sleep(200);

    const started = liveDiscoveryOf({ target, alive: client.alive });

    if (started && fits({ found: started, target, client }) && (await answers(started, client))) {
      writeFileSync(coldStartFileOf(target), JSON.stringify({ seconds: Math.ceil((client.now() - began) / 1000) }));

      return started;
    }
  }

  return `the resident design process did not start within ${Math.round(client.startTimeoutMs / 1000)} s (log: ${residentLogOf(target)})`;
};

const servedRefusalOf = (found: Discovery, client: ResidentClient) =>
  found.build === client.build
    ? `design serve (pid ${found.pid}) hosts the resident design process but did not answer`
    : `design serve (pid ${found.pid}) hosts the resident design process with another cli build`;

/**
 * Takes the resident of the checkout for a `design serve` under the start lock: stops a standalone resident process,
 * and answers a reason instead when another serve already hosts one that answers. `release` must run once the serve
 * wrote its discovery file.
 */
export const takeResidentForServe = async (
  target: string,
  client: ResidentClient,
): Promise<{ ok: true; release: () => void } | { ok: false; reason: string }> => {
  const directory = join(residentDirOf(target), 'start');
  const lock = await acquireApiLock({
    directory,
    command: 'design serve hosts the resident',
    wait: client.startTimeoutMs / 1000,
    cwd: target,
    onHeld: () => client.err('waiting for the start lock of the resident design process\n'),
  });

  if (!lock.ok) return { ok: false, reason: 'the start lock of the resident design process stayed taken' };

  const release = () => releaseApiLock(directory, lock.lock.token);
  const found = liveDiscoveryOf({ target, alive: client.alive });

  if (found && servedBy(found) && (await answers(found, client))) {
    release();

    return { ok: false, reason: `design serve (pid ${found.pid}) already hosts the resident design process` };
  }

  if (found && !servedBy(found)) {
    await stopProcess({ found, target, client });
    client.err(`stopped the resident design process (pid ${found.pid}); this design serve hosts it now\n`);
  }

  return { ok: true, release };
};

/**
 * The live resident process of the checkout, started detached when there is none or the one there runs another CLI
 * build; a reason string when it cannot be reached and the call must run in its own process.
 */
export const ensureResident = async (target: string, client: ResidentClient): Promise<Discovery | string> => {
  const first = liveDiscoveryOf({ target, alive: client.alive });

  if (first && fits({ found: first, target, client }) && (await answers(first, client))) return first;
  if (first && servedBy(first)) return servedRefusalOf(first, client);

  const directory = join(residentDirOf(target), 'start');
  const lock = await acquireApiLock({
    directory,
    command: 'design resident start',
    wait: client.startTimeoutMs / 1000,
    cwd: target,
    onHeld: () => client.err('waiting for the resident design process to start\n'),
  });

  if (!lock.ok) return 'the start lock of the resident design process stayed taken';

  try {
    const found = liveDiscoveryOf({ target, alive: client.alive });

    if (found && servedBy(found)) {
      return fits({ found, target, client }) && (await answers(found, client)) ? found : servedRefusalOf(found, client);
    }

    if (found && found.checkout === resolve(target)) {
      if (fits({ found, target, client })) {
        if (await answers(found, client)) return found;

        await stopProcess({ found, target, client });

        return `the resident design process (pid ${found.pid}) did not answer and was stopped`;
      }

      await stopProcess({ found, target, client });
    }

    removeDiscovery(target);

    return await startResident(target, client);
  } finally {
    releaseApiLock(directory, lock.lock.token);
  }
};

/** Sends one run request and writes its output as it arrives; null when the process ends or falls silent first. */
export const sendRun = ({
  found,
  asked,
  client,
}: {
  found: Discovery;
  asked: ResidentRequest;
  client: ResidentClient;
}): Promise<number | null> =>
  new Promise((done) => {
    let exit: number | null = null;
    const request = httpRequest(
      {
        host: '127.0.0.1',
        port: found.port,
        method: 'POST',
        path: '/run',
        headers: { [TOKEN_HEADER]: found.token, 'content-type': 'application/json' },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          done(null);

          return;
        }

        let buffer = '';

        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          buffer += chunk;

          const lines = buffer.split('\n');

          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line) continue;

            const frame = JSON.parse(line) as ResidentFrame;

            if ('o' in frame) client.out(frame.o);
            else if ('e' in frame) client.err(frame.e);
            else if ('exit' in frame) exit = frame.exit;
          }
        });
        response.once('end', () => done(exit));
        response.once('close', () => done(exit));
        response.once('error', () => done(null));
      },
    );

    request.setTimeout(client.silenceMs, () => request.destroy());
    request.once('error', () => done(exit));
    request.end(JSON.stringify(asked));
  });

const servedResidentOf = async (target: string, client: ResidentClient) => {
  const found = liveDiscoveryOf({ target, alive: client.alive });

  return found && servedBy(found) && fits({ found, target, client }) && (await answers(found, client)) ? found : null;
};

/**
 * Runs `et design <argv>` in the resident process of the checkout and answers its exit code, or null after one printed
 * line when the call must run in its own process: in CI, with `ETHLETE_DESIGN_RESIDENT=0`, or when the process fails.
 * In a `yarn scratch:checkout` copy it stops the process after the run, so no resident or Chromium outlives the call.
 */
export const runThroughResident = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  client: ResidentClient;
}): Promise<number | null> => {
  const { target, argv, invocation, client } = options;

  if (!residentWanted(client.env) && !sharedServeWanted(client.env)) return null;

  const found = residentWanted(client.env)
    ? await ensureResident(target, client)
    : await servedResidentOf(target, client);

  if (found === null) return null;

  if (typeof found === 'string') {
    client.err(`${found} - running in-process\n`);

    return null;
  }

  const env = Object.fromEntries(FORWARDED_ENV.flatMap((key) => (client.env[key] ? [[key, client.env[key]]] : [])));
  const code = await sendRun({ found, asked: { argv, invocation, env }, client });

  if (code === null)
    client.err(`the resident design process (pid ${found.pid}) ended without an answer - running in-process\n`);

  if (!servedBy(found) && existsSync(join(target, SCRATCH_MARKER))) {
    await stopProcess({ found, target, client });
    client.err(`stopped the resident design process (pid ${found.pid}) of this scratch copy\n`);
  }

  return code;
};

/** `et design stop`: ends the resident process of the checkout. */
export const stopResident = async (target: string, client: ResidentClient) => {
  const found = liveDiscoveryOf({ target, alive: client.alive });

  if (!found) {
    client.out('no resident design process runs\n');

    return 0;
  }

  if (servedBy(found)) {
    client.out(`design serve (pid ${found.pid}) hosts the resident design process; it ends with that server\n`);

    return 0;
  }

  await stopProcess({ found, target, client });
  client.out(`stopped the resident design process (pid ${found.pid})\n`);

  return 0;
};
