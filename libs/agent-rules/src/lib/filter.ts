import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SyncConfig } from './config';
import { ContentItem } from './load-content';

export type SkippedItem = {
  name: string;
  reason: string;
};

export type FilterResult = {
  kept: ContentItem[];
  skipped: SkippedItem[];
};

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * A hoisted `node_modules` entry counts as installed even when the dependency is declared in a
 * workspace package rather than at the root, so monorepo consumers are not silently filtered out.
 */
export const isPackageInstalled = (root: string, packageName: string) => {
  if (existsSync(join(root, 'node_modules', ...packageName.split('/')))) return true;

  const manifestPath = join(root, 'package.json');

  if (!existsSync(manifestPath)) return false;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest;
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };

  return Object.prototype.hasOwnProperty.call(declared, packageName);
};

export const filterContent = (items: ContentItem[], config: SyncConfig): FilterResult => {
  const kept: ContentItem[] = [];
  const skipped: SkippedItem[] = [];

  for (const item of items) {
    const { name, scope, requires, vars } = item.frontmatter;

    if (config.exclude.includes(name)) {
      skipped.push({ name, reason: 'excluded by config' });
      continue;
    }

    if (!config.scopes.includes(scope)) {
      skipped.push({ name, reason: `scope "${scope}" is not emitted for this profile` });
      continue;
    }

    const missingPackage = requires.find((packageName) => !isPackageInstalled(config.root, packageName));

    if (missingPackage) {
      skipped.push({ name, reason: `requires ${missingPackage}, which is not installed` });
      continue;
    }

    const missingVar = vars.find((varName) => config.vars[varName] === undefined);

    if (missingVar) {
      skipped.push({ name, reason: `needs the "${missingVar}" variable — set it in vars` });
      continue;
    }

    kept.push(item);
  }

  return { kept, skipped };
};
