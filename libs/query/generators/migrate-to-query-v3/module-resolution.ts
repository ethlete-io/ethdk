import { Tree, joinPathFragments, readJson, visitNotIgnoredFiles } from '@nx/devkit';
import { dirname } from 'node:path';
import { MigrationScope } from './migration-scope.js';
import { ModuleGraph, createModuleGraph } from './module-graph.js';
import { QueryV3MigrationReport } from './report.js';

const PROJECT_TSCONFIGS = ['tsconfig.lib.json', 'tsconfig.app.json', 'tsconfig.spec.json'];
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

const projectsReaching = (tree: Tree, graph: ModuleGraph, importingRoots: Set<string>) => {
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

export type LegacyModuleResolution = {
  configPath: string;
  resolution: string;
  specifier: string | null;
  alias: string | null;
};

/**
 * Lists every project tsconfig that resolves modules with `node` / `node10` while the project imports a specifier
 * `matches` accepts, directly or through a workspace path alias. That resolution ignores the `exports` map, so a
 * package subpath like `@ethlete/query/testing` does not resolve.
 */
export const findLegacyModuleResolutions = (
  tree: Tree,
  graph: ModuleGraph,
  files: Iterable<string>,
  matches: (specifier: string) => boolean,
) => {
  const directSpecifiers = new Map<string, string>();

  for (const filePath of files) {
    if (!filePath.endsWith('.ts')) continue;

    const root = projectRootOf(tree, filePath);

    if (!root || directSpecifiers.has(root)) continue;

    const specifier = Array.from((tree.read(filePath, 'utf-8') ?? '').matchAll(MODULE_SPECIFIER), ([, s]) => s).find(
      (s) => s !== undefined && matches(s),
    );

    if (specifier) directSpecifiers.set(root, specifier);
  }

  if (!directSpecifiers.size) return [];

  const reached = projectsReaching(tree, graph, new Set(directSpecifiers.keys()));
  const findings: LegacyModuleResolution[] = [];

  for (const root of [...reached.keys()].sort()) {
    const alias = reached.get(root) ?? null;

    for (const name of PROJECT_TSCONFIGS) {
      const configPath = joinPathFragments(root, name);
      const resolution = effectiveModuleResolution(tree, configPath);

      if (!resolution || !LEGACY_RESOLUTIONS.has(resolution)) continue;

      findings.push({ configPath, resolution, specifier: directSpecifiers.get(root) ?? null, alias });
    }
  }

  return findings;
};

const ETHLETE_SUBPATH = /^@ethlete\/[^/]+\/./;

/**
 * Records a follow-up for every node-resolving project tsconfig whose project imports an `@ethlete/*` subpath
 * (`@ethlete/query/testing`, `@ethlete/query-devtools/lazy`, ...), directly or through a workspace path alias.
 * Runs after the rewrites, so it also sees the subpaths the migration itself adds.
 */
export const reportLegacyModuleResolution = (tree: Tree, scope: MigrationScope, report: QueryV3MigrationReport) => {
  const files: string[] = [];

  scope.visit(tree, (filePath) => files.push(filePath));

  for (const { configPath, resolution, specifier, alias } of findLegacyModuleResolutions(
    tree,
    createModuleGraph(tree),
    files,
    (candidate) => ETHLETE_SUBPATH.test(candidate),
  )) {
    report.addFollowUp({
      title: 'Project resolves modules with `node`, which cannot find `@ethlete/*` subpaths',
      summary: alias
        ? `${configPath} resolves modules with \`${resolution}\` and reaches an \`@ethlete/*\` subpath through \`${alias}\`.`
        : `${configPath} resolves modules with \`${resolution}\` and imports \`${specifier}\`.`,
      action:
        '`moduleResolution: node` (`node10`) ignores the `exports` map of the `@ethlete/*` packages, so subpath imports like `@ethlete/query-devtools/lazy` do not resolve - also when they sit in another project this one imports through a path alias. Set `moduleResolution` to `bundler` (or `node16` / `nodenext`) in the listed tsconfig or the base config it inherits it from.',
      locations: [{ filePath: configPath }],
      source: 'module-resolution',
    });
  }
};
