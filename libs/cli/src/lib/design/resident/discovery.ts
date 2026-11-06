import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

/** What a resident design process writes so the CLI of its checkout finds it. */
export type Discovery = {
  pid: number;
  port: number;
  checkout: string;
  build: string;
  token: string;
  startedAt: string;
};

export type IsAlive = (pid: number) => boolean;

export const isAlive: IsAlive = (pid) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

export const residentDirOf = (target: string) => join(target, 'tmp', 'design-resident');

const discoveryPathOf = (target: string) => join(residentDirOf(target), 'process.json');

export const readDiscovery = (target: string): Discovery | null => {
  try {
    const value = JSON.parse(readFileSync(discoveryPathOf(target), 'utf8')) as Partial<Discovery>;

    return typeof value.pid === 'number' &&
      typeof value.port === 'number' &&
      typeof value.token === 'string' &&
      typeof value.build === 'string' &&
      typeof value.checkout === 'string'
      ? (value as Discovery)
      : null;
  } catch {
    return null;
  }
};

export const writeDiscovery = (target: string, discovery: Discovery) => {
  const file = discoveryPathOf(target);
  const written = `${file}.${discovery.pid}`;

  mkdirSync(residentDirOf(target), { recursive: true });
  writeFileSync(written, `${JSON.stringify(discovery, null, 2)}\n`);
  renameSync(written, file);
};

/** Removes the discovery file, or with `pid` only the one that process wrote. */
export const removeDiscovery = (target: string, pid?: number) => {
  if (pid !== undefined && readDiscovery(target)?.pid !== pid) return;

  rmSync(discoveryPathOf(target), { force: true });
};

/** The discovery file of the checkout, after removing one whose process is gone. */
export const liveDiscoveryOf = (options: { target: string; alive?: IsAlive }): Discovery | null => {
  const { target, alive = isAlive } = options;
  const found = readDiscovery(target);

  if (!found) return null;

  if (alive(found.pid)) return found;

  removeDiscovery(target, found.pid);

  return null;
};
