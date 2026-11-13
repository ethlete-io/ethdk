import { AsyncLocalStorage } from 'async_hooks';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { writeJsonFile } from '../../json-file';

const inMemory = new AsyncLocalStorage<Map<string, string>>();

/**
 * Runs `run` with every write to a stamp file (`merged.json`, `ready.json`) kept in memory: reads in the run see the
 * writes, the files on disk stay as they are. Work outside `run` in the same process, such as the design server's slow
 * runner, still reads and writes the files.
 */
export const withStampsInMemory = <T>(run: () => Promise<T>): Promise<T> =>
  inMemory.run(inMemory.getStore() ?? new Map(), run);

/** The text of a stamp file as the run sees it, or `null` when there is none. */
export const readStampText = (file: string): string | null => {
  const key = resolve(file);
  const held = inMemory.getStore()?.get(key);

  if (held !== undefined) return held;

  return existsSync(key) ? readFileSync(key, 'utf8') : null;
};

/** Writes `value` as a stamp file, or keeps it in memory inside `withStampsInMemory`. */
export const writeStampFile = (file: string, value: unknown) => {
  const held = inMemory.getStore();

  if (held) held.set(resolve(file), JSON.stringify(value));
  else writeJsonFile({ file, value });
};
