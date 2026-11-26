import { Tree } from '@nx/devkit';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { findLegacyModuleResolutions } from '../migrate-to-query-v3/module-resolution.js';
import { INTEROP_MODULE } from './facade.js';
import { ToolkitMigrationReport } from './report.js';

export const MODULE_RESOLUTION_TASK = 'NTK-MODULE-RESOLUTION';

/**
 * Records a task for every project tsconfig that resolves modules with `node` / `node10` while the project imports
 * `@ethlete/query/ngrx-toolkit`, directly or through a workspace path alias.
 */
export const reportLegacyModuleResolution = (
  tree: Tree,
  graph: ModuleGraph,
  files: Iterable<string>,
  report: ToolkitMigrationReport,
) => {
  report.define(MODULE_RESOLUTION_TASK, {
    title: 'Project resolves modules with `node`, which cannot find `@ethlete/query/ngrx-toolkit`',
    action:
      '`moduleResolution: node` (`node10`) ignores the `exports` map of `@ethlete/query`, so the `@ethlete/query/ngrx-toolkit` import does not resolve - also when it sits in another project this one imports through a path alias. Set `moduleResolution` to `bundler` in the listed tsconfig (or the base config it inherits it from).',
  });

  for (const { configPath, resolution, alias } of findLegacyModuleResolutions(
    tree,
    graph,
    files,
    (specifier) => specifier === INTEROP_MODULE,
  )) {
    report.add({
      id: MODULE_RESOLUTION_TASK,
      summary: alias
        ? `${configPath} resolves modules with \`${resolution}\` and reaches \`${INTEROP_MODULE}\` through \`${alias}\`.`
        : `${configPath} resolves modules with \`${resolution}\`.`,
      locations: [{ filePath: configPath }],
    });
  }
};
