import { workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const MIGRATION_KINDS = ['move', 'rename', 'reshape', 'rename+reshape', 'replaced-by', 'removed'] as const;

export type MigrationKind = (typeof MIGRATION_KINDS)[number];

export type MigrationPackage = '@ethlete/components' | '@ethlete/core';

export type MigrationEntry = {
  to?: string;
  package?: MigrationPackage;
  kind: MigrationKind;
  docs?: string;
  note?: string;
  signatureUnchanged?: boolean;

  /** Minimum version of `package` that ships the successor. */
  since?: string;
};

export type MigrationMap = Record<string, MigrationEntry>;

/** Kinds whose successor is reachable by editing the import statement alone. */
export const MECHANICAL_KINDS: readonly MigrationKind[] = ['move', 'rename'];

/** Kinds whose successor needs a human: the contract changed, or several symbols replace one. */
export const JUDGMENT_KINDS: readonly MigrationKind[] = ['reshape', 'rename+reshape', 'replaced-by'];

export const CDK_PACKAGE = '@ethlete/cdk';

const MAP_CANDIDATES = [`node_modules/${CDK_PACKAGE}/migration-map.json`, 'libs/cdk/migration-map.json'];

export const loadMigrationMap = (mapPath?: string): MigrationMap => {
  const candidates = mapPath
    ? [isAbsolute(mapPath) ? mapPath : join(workspaceRoot, mapPath)]
    : MAP_CANDIDATES.map((candidate) => join(workspaceRoot, candidate));

  const found = candidates.find((candidate) => existsSync(candidate));

  if (!found) {
    throw new Error(
      `Could not read the cdk migration map. Looked in ${candidates.join(', ')}. Install ${CDK_PACKAGE} or pass --mapPath.`,
    );
  }

  return JSON.parse(readFileSync(found, 'utf-8')) as MigrationMap;
};
