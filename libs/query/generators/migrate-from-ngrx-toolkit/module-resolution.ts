import { Tree, joinPathFragments, readJson, visitNotIgnoredFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { INTEROP_MODULE } from './facade.js';
import { ToolkitMigrationReport } from './report.js';

export const MODULE_RESOLUTION_TASK = 'NTK-MODULE-RESOLUTION';

const PROJECT_TSCONFIGS = ['tsconfig.lib.json', 'tsconfig.app.json', 'tsconfig.spec.json'];
const INTEROP_IMPORT = new RegExp(`['"]${INTEROP_MODULE}['"]`);
const LEGACY_RESOLUTIONS = new Set(['node', 'node10']);
const MODULE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

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

type AliasEdge = { alias: string; targetRoot: string };

const collectAliasEdges = (tree: Tree, graph: ModuleGraph) => {
  const edges = new Map<string, AliasEdge[]>();

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.includes('node_modules/')) return;

    const fromRoot = projectRootOf(tree, filePath);

    if (!fromRoot) return;

    for (const [, specifier] of (tree.read(filePath, 'utf-8') ?? '').matchAll(MODULE_SPECIFIER)) {
      if (!specifier || specifier.startsWith('.') || !graph.isWorkspaceSpecifier(specifier)) continue;

      const target = graph.resolveFile(filePath, specifier);
      const targetRoot = target ? projectRootOf(tree, target) : null;

      if (!targetRoot || targetRoot === fromRoot) continue;

      const list = edges.get(fromRoot) ?? [];

      if (!list.some((edge) => edge.alias === specifier)) list.push({ alias: specifier, targetRoot });

      edges.set(fromRoot, list);
    }
  });

  edges.forEach((list) => list.sort((a, b) => a.alias.localeCompare(b.alias)));

  return edges;
};

/**
 * The project roots that compile the interop import: the importing projects (value `null`), and every project that
 * reaches one of them through workspace path aliases, since an alias pulls the target's sources into the compilation
 * (value: the first alias on that path).
 */
const projectsReachingInterop = (tree: Tree, graph: ModuleGraph, importingRoots: Set<string>) => {
  const reached = new Map<string, string | null>([...importingRoots].map((root) => [root, null]));
  const edges = collectAliasEdges(tree, graph);
  const roots = [...edges.keys()].sort();
  let grew = true;

  while (grew) {
    grew = false;

    for (const root of roots) {
      if (reached.has(root)) continue;

      const edge = edges.get(root)!.find(({ targetRoot }) => reached.has(targetRoot));

      if (!edge) continue;

      reached.set(root, edge.alias);
      grew = true;
    }
  }

  return reached;
};

/**
 * Records a task for every project tsconfig that resolves modules with `node` / `node10` while the project imports
 * `@ethlete/query/ngrx-toolkit`, directly or through a workspace path alias: that resolution ignores the `exports`
 * map, so the subpath does not resolve.
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

  const importingRoots = new Set<string>();

  for (const filePath of files) {
    if (!filePath.endsWith('.ts') || !INTEROP_IMPORT.test(tree.read(filePath, 'utf-8') ?? '')) continue;

    const root = projectRootOf(tree, filePath);

    if (root) importingRoots.add(root);
  }

  if (!importingRoots.size) return;

  const reached = projectsReachingInterop(tree, graph, importingRoots);

  for (const root of [...reached.keys()].sort()) {
    const alias = reached.get(root);

    for (const name of PROJECT_TSCONFIGS) {
      const configPath = joinPathFragments(root, name);
      const resolution = effectiveModuleResolution(tree, configPath);

      if (!resolution || !LEGACY_RESOLUTIONS.has(resolution)) continue;

      report.add({
        id: MODULE_RESOLUTION_TASK,
        summary: alias
          ? `${configPath} resolves modules with \`${resolution}\` and reaches \`${INTEROP_MODULE}\` through \`${alias}\`.`
          : `${configPath} resolves modules with \`${resolution}\`.`,
        locations: [{ filePath: configPath }],
      });
    }
  }
};
