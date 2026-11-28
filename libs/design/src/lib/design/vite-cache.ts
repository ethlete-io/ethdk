import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { basename, dirname, resolve } from 'path';
import { isRunning } from './is-running';
import { workRootOf } from './work-root';

/** A Vite cache folder of its own per checkout, so two servers sharing a symlinked `node_modules` never rewrite each other's deps. */
export const viteCacheOf = (target: string, name: string) =>
  resolve(workRootOf(target), `${name}-${createHash('sha1').update(resolve(target)).digest('hex').slice(0, 10)}`);

const holdsLock = (lock: string) => {
  try {
    writeFileSync(lock, String(process.pid), { flag: 'wx' });

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  const holder = existsSync(lock) ? Number(readFileSync(lock, 'utf8')) : 0;

  if (holder && isRunning(holder)) return false;

  rmSync(lock, { force: true });

  return holdsLock(lock);
};

let claims = 0;
const claimed = new Set<() => void>();
let exitHooked = false;

/**
 * A Vite cache folder that no other running server writes to: the shared `name` folder while this
 * server holds its lock, else a folder of its own that `release` removes. Only one server at a time
 * keeps the optimized deps between runs, so two at once never rewrite each other's.
 */
export const claimViteCache = (target: string, name: string) => {
  const shared = viteCacheOf(target, name);
  const root = dirname(shared);
  const lock = `${shared}.lock`;
  const own = new RegExp(`^${basename(shared)}-(\\d+)-\\d+$`);

  mkdirSync(root, { recursive: true });

  for (const entry of readdirSync(root)) {
    const pid = Number(own.exec(entry)?.[1]);

    if (pid && !isRunning(pid)) rmSync(resolve(root, entry), { recursive: true, force: true });
  }

  const dir = holdsLock(lock) ? shared : `${shared}-${process.pid}-${(claims += 1)}`;
  const release = () => {
    if (!claimed.delete(release)) return;
    rmSync(dir === shared ? lock : dir, { recursive: true, force: true });
  };

  if (!exitHooked) {
    exitHooked = true;
    process.once('exit', () => [...claimed].forEach((held) => held()));
  }
  claimed.add(release);

  return { dir, release };
};
