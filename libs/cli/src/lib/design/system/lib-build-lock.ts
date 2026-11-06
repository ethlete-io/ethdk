import { randomUUID } from 'crypto';
import { hostname } from 'os';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { acquireApiLock, LockSystem, releaseApiLock } from '../../api/lock';

export const LIB_READER_ENV = 'ETHLETE_DESIGN_LIB_READER';

const POLL_MS = 1000;

const realSystem = (): LockSystem => ({
  now: () => Date.now(),
  sleep: async (ms) => void (await delay(ms)),
  kill: (pid, signal) => void process.kill(pid, signal),
  hostname,
  pid: process.pid,
});

type Reader = { pid: number; hostname: string; file: string };

const isAlive = (system: LockSystem, reader: Reader) => {
  if (reader.hostname !== system.hostname()) return true;

  try {
    system.kill(reader.pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

const liveReadersOf = (directory: string, system: LockSystem): Reader[] =>
  readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const file = join(directory, name);

      try {
        const reader = { ...(JSON.parse(readFileSync(file, 'utf8')) as Omit<Reader, 'file'>), file };

        if (isAlive(system, reader)) return [reader];

        rmSync(file, { force: true });

        return [];
      } catch {
        return [];
      }
    });

/**
 * Shared/exclusive lock on the lib build folders in `directory`. A caller takes the build lock, rebuilds only when
 * `stale()` answers true and no other caller still reads the build, registers as a reader and drops the build lock.
 * `release` ends the read; until then no other caller rebuilds. Prints one waiting line per wait.
 */
export const readFreshLibBuild = async (options: {
  directory: string;
  stale: () => boolean;
  rebuild: () => boolean | Promise<boolean>;
  log?: (line: string) => void;
  env?: NodeJS.ProcessEnv;
  system?: LockSystem;
}): Promise<{ ok: boolean; release: () => void }> => {
  const { directory, stale, rebuild, log = (line) => console.error(line), env = process.env } = options;
  const system = options.system ?? realSystem();

  if (env[LIB_READER_ENV]) return { ok: true, release: () => undefined };

  const readers = join(directory, 'readers');
  mkdirSync(readers, { recursive: true });

  const acquired = await acquireApiLock({
    directory: join(directory, 'build'),
    command: 'design lib build',
    cwd: directory,
    system,
    onHeld: (holder) => log(`waiting for the lib build of pid ${holder?.pid ?? 'unknown'}`),
  });

  if (!acquired.ok) return { ok: false, release: () => undefined };

  try {
    if (stale()) {
      let announced = false;

      for (let others = liveReadersOf(readers, system); others.length > 0; others = liveReadersOf(readers, system)) {
        if (!announced) {
          announced = true;
          log(
            `waiting for the design runs of pid ${others.map((reader) => reader.pid).join(', ')} to finish reading the lib build`,
          );
        }

        await system.sleep(POLL_MS);
      }

      if (!(await rebuild())) return { ok: false, release: () => undefined };
    }

    const token = randomUUID();
    const file = join(readers, `${system.pid}-${token}.json`);

    writeFileSync(file, JSON.stringify({ pid: system.pid, hostname: system.hostname() }));
    env[LIB_READER_ENV] = token;

    const release = () => {
      process.off('exit', release);
      rmSync(file, { force: true });

      if (env[LIB_READER_ENV] === token) delete env[LIB_READER_ENV];
    };

    process.once('exit', release);

    return { ok: true, release };
  } finally {
    releaseApiLock(join(directory, 'build'), acquired.lock.token);
  }
};
