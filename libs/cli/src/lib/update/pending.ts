import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { UPDATE_DIR } from './tasks';

export const PENDING_FILE = join(UPDATE_DIR, 'pending.json');

export type PendingPackage = {
  name: string;
  /** The version that was installed before the update, which the migrations run from. */
  from: string | null;
  to: string;
};

export type PendingUpdate = {
  startedAt: string;
  packages: PendingPackage[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Records what an update moved, before the install replaces the versions the migrations run from. An
 * install or a codemod that fails leaves this file behind, so `et update --continue` can pick it up.
 */
export const writePendingUpdate = (options: { root: string; pending: PendingUpdate }) => {
  const { root, pending } = options;

  mkdirSync(join(root, UPDATE_DIR), { recursive: true });
  writeFileSync(join(root, PENDING_FILE), `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
};

export const readPendingUpdate = (root: string): PendingUpdate | undefined => {
  const path = join(root, PENDING_FILE);

  if (!existsSync(path)) return undefined;

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed['packages'])) return undefined;

  const packages = parsed['packages'].filter(
    (entry): entry is PendingPackage =>
      isRecord(entry) && typeof entry['name'] === 'string' && typeof entry['to'] === 'string',
  );

  return {
    startedAt: typeof parsed['startedAt'] === 'string' ? parsed['startedAt'] : 'an earlier run',
    packages: packages.map((entry) => ({ name: entry.name, from: entry.from ?? null, to: entry.to })),
  };
};

export const clearPendingUpdate = (root: string) => rmSync(join(root, PENDING_FILE), { force: true });
