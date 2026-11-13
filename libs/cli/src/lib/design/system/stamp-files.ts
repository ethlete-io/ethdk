import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { writeJsonFile } from '../../json-file';

let inMemory: Map<string, string> | null = null;

/**
 * Runs `run` with every write to a stamp file (`merged.json`, `ready.json`) kept in memory: reads in the run see the
 * writes, the files on disk stay as they are.
 */
export const withStampsInMemory = async <T>(run: () => Promise<T>): Promise<T> => {
  const outer = inMemory;

  inMemory = outer ?? new Map();

  try {
    return await run();
  } finally {
    inMemory = outer;
  }
};

/** The text of a stamp file as the run sees it, or `null` when there is none. */
export const readStampText = (file: string): string | null => {
  const key = resolve(file);
  const held = inMemory?.get(key);

  if (held !== undefined) return held;

  return existsSync(key) ? readFileSync(key, 'utf8') : null;
};

/** Writes `value` as a stamp file, or keeps it in memory inside `withStampsInMemory`. */
export const writeStampFile = (file: string, value: unknown) => {
  if (inMemory) inMemory.set(resolve(file), JSON.stringify(value));
  else writeJsonFile({ file, value });
};
