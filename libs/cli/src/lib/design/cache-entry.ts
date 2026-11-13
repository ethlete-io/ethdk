import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { threadId } from 'worker_threads';
import { runSignal } from './run-abort';

let temps = 0;

/**
 * @internal Writes `entry.text` as the entry `entry.name` of the disk cache in `dir`, whole or not at all. Writes nothing once the
 * run in progress is aborted, whose results may come from a closing browser. False when nothing was written.
 */
export const writeCacheEntry = (dir: string, entry: { name: string; text: string }) => {
  const { name, text } = entry;

  if (runSignal()?.aborted) return false;

  const temp = join(dir, `.${name}.${process.pid}.${threadId}.${(temps += 1)}.tmp`);

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(temp, text);
    renameSync(temp, join(dir, name));

    return true;
  } catch {
    rmSync(temp, { force: true });

    return false;
  }
};
