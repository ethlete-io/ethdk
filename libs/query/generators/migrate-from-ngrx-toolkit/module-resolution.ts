import { Tree, joinPathFragments, readJson } from '@nx/devkit';
import { dirname } from 'node:path';
import { INTEROP_MODULE } from './facade.js';
import { ToolkitMigrationReport } from './report.js';

export const MODULE_RESOLUTION_TASK = 'NTK-MODULE-RESOLUTION';

const PROJECT_TSCONFIGS = ['tsconfig.lib.json', 'tsconfig.app.json', 'tsconfig.spec.json'];
const INTEROP_IMPORT = new RegExp(`['"]${INTEROP_MODULE}['"]`);
const LEGACY_RESOLUTIONS = new Set(['node', 'node10']);

type TsConfigJson = {
  extends?: string | string[];
  compilerOptions?: { moduleResolution?: string };
};

const projectRootOf = (tree: Tree, filePath: string) => {
  let dir = dirname(filePath);

  while (dir !== '.' && dir !== '/' && dir !== '') {
    if (tree.exists(joinPathFragments(dir, 'project.json'))) return dir;

    dir = dirname(dir);
  }

  return null;
};

const effectiveModuleResolution = (tree: Tree, configPath: string, seen = new Set<string>()): string | null => {
  if (seen.has(configPath) || !tree.exists(configPath)) return null;

  seen.add(configPath);

  const config = readJson<TsConfigJson>(tree, configPath);
  const own = config.compilerOptions?.moduleResolution;

  if (own) return own.toLowerCase();

  const parents = config.extends === undefined ? [] : [config.extends].flat();

  for (const parent of [...parents].reverse()) {
    if (!parent.startsWith('.')) continue;

    const resolved = effectiveModuleResolution(
      tree,
      joinPathFragments(dirname(configPath), parent.endsWith('.json') ? parent : `${parent}.json`),
      seen,
    );

    if (resolved) return resolved;
  }

  return null;
};

/**
 * Records a task for every project tsconfig that resolves modules with `node` / `node10` while the project imports
 * `@ethlete/query/ngrx-toolkit`: that resolution ignores the `exports` map, so the subpath does not resolve.
 */
export const reportLegacyModuleResolution = (tree: Tree, files: Iterable<string>, report: ToolkitMigrationReport) => {
  report.define(MODULE_RESOLUTION_TASK, {
    title: 'Project resolves modules with `node`, which cannot find `@ethlete/query/ngrx-toolkit`',
    action:
      '`moduleResolution: node` (`node10`) ignores the `exports` map of `@ethlete/query`, so the `@ethlete/query/ngrx-toolkit` import does not resolve. Set `moduleResolution` to `bundler` in the listed tsconfig (or the base config it inherits it from).',
  });

  const roots = new Set<string>();

  for (const filePath of files) {
    if (!filePath.endsWith('.ts') || !INTEROP_IMPORT.test(tree.read(filePath, 'utf-8') ?? '')) continue;

    const root = projectRootOf(tree, filePath);

    if (root) roots.add(root);
  }

  for (const root of [...roots].sort()) {
    for (const name of PROJECT_TSCONFIGS) {
      const configPath = joinPathFragments(root, name);
      const resolution = effectiveModuleResolution(tree, configPath);

      if (!resolution || !LEGACY_RESOLUTIONS.has(resolution)) continue;

      report.add({
        id: MODULE_RESOLUTION_TASK,
        summary: `${configPath} resolves modules with \`${resolution}\`.`,
        locations: [{ filePath: configPath }],
      });
    }
  }
};
