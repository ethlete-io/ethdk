import { Tree, formatFiles } from '@nx/devkit';
import { MigrationScopeOptions, createMigrationScope } from '../migrate-to-query-v3/migration-scope.js';
import { createModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import {
  ClientHelpers,
  clientBaseName,
  helperName,
  indexExistingCreators,
  isPublicRoute,
  writeQueriesFile,
} from './creators.js';
import { ToolkitConsumerStats, migrateToolkitConsumers } from './consumers.js';
import { rewriteFacade } from './facade.js';
import { ToolkitFeature, discoverFeatures } from './feature.js';
import { TOOLKIT_TASK, ToolkitMigrationReport } from './report.js';
import { removeFeatureStores } from './store-removal.js';

export type ToolkitMigrationOptions = MigrationScopeOptions & {
  client: string;
  clientImport: string;
  publicRoutes?: string | string[];
  serviceApiBase?: string;
};

type MigrationSchema = ToolkitMigrationOptions & {
  skipFormat?: boolean;
};

export type ToolkitMigrationStats = {
  featuresFound: number;
  featuresConverted: number;
  featuresSkipped: number;
  storeFilesKept: number;
  creatorsWritten: number;
  creatorsReused: number;
  deletedFiles: string[];
  consumers: ToolkitConsumerStats;
};

const parsePublicRoutes = (value: string | string[] | undefined) => {
  if (value === undefined) return null;

  const routes = (Array.isArray(value) ? value : value.split(','))
    .map((route) => route.trim())
    .filter((route) => route.length > 0);

  return routes.length > 0 ? routes : null;
};

const assertHelpersExist = (
  tree: Tree,
  graph: ReturnType<typeof createModuleGraph>,
  helpers: ClientHelpers,
  names: ReadonlySet<string>,
) => {
  const isFile = tree.exists(helpers.importFrom);
  const fromFile = isFile ? helpers.importFrom : '';
  const specifier = isFile ? `./${helpers.importFrom.split('/').pop()}` : helpers.importFrom;

  if (!graph.resolveFile(fromFile, specifier)) return;

  const missing = [...names].filter((name) => !graph.findDeclaringFile(fromFile, specifier, name));

  if (missing.length > 0) {
    throw new Error(
      `${helpers.importFrom} does not export ${missing.join(', ')}. Run \`@ethlete/query:migrate-to-query-v3\` first, or check --client and --clientImport.`,
    );
  }
};

const resolveApiBase = (features: readonly ToolkitFeature[], option: string | undefined) => {
  if (option) return option;

  const bases = [...new Set(features.map((feature) => feature.apiBase).filter((base): base is string => !!base))];

  if (bases.length > 1) {
    throw new Error(
      `The toolkit services use ${bases.length} API bases: ${bases.join(', ')}. Pass the one --client points at with --serviceApiBase; features on the others are left alone.`,
    );
  }

  return bases[0] ?? null;
};

/** Runs the migration on `tree` - store side, then consumers - and records follow-up tasks in `report`. */
export const migrateToolkitStores = (
  tree: Tree,
  options: ToolkitMigrationOptions,
  report: ToolkitMigrationReport,
): ToolkitMigrationStats => {
  if (!options.client || !options.clientImport) {
    throw new Error('Pass --client (e.g. apiClient) and --clientImport (e.g. @app/queries).');
  }

  const scope = createMigrationScope(tree, options);
  const graph = createModuleGraph(tree);
  const inScope = new Set<string>();

  scope.visit(tree, (filePath) => {
    if (filePath.endsWith('.ts')) inScope.add(filePath);
  });

  const visit = (callback: (filePath: string) => void) => inScope.forEach(callback);
  const helpers: ClientHelpers = {
    baseName: clientBaseName(options.client),
    importFrom: options.clientImport,
    publicRoutes: parsePublicRoutes(options.publicRoutes),
  };

  const discovered = discoverFeatures(tree, graph, visit);

  discovered.commentedOut.forEach((filePath) =>
    report.add({
      id: TOOLKIT_TASK.COMMENTED_FEATURE,
      summary: `${filePath} only contains commented-out action groups.`,
      locations: [{ filePath }],
    }),
  );
  discovered.facadesWithoutHttp.forEach((filePath) =>
    report.add({
      id: TOOLKIT_TASK.FACADE_WITHOUT_HTTP,
      summary: `${filePath} extends \`FacadeBase\` without action groups.`,
      locations: [{ filePath }],
    }),
  );

  const apiBase = resolveApiBase(discovered.features, options.serviceApiBase);

  for (const feature of discovered.features) {
    if (feature.apiBase && apiBase && feature.apiBase !== apiBase) {
      feature.blockers.push({
        id: TOOLKIT_TASK.SERVICE_API_BASE,
        summary: `The service uses \`${feature.apiBase}\`, not \`${apiBase}\`.`,
        locations: [{ filePath: feature.files.service! }],
      });
    }
  }

  const neededHelpers = new Set(
    discovered.features
      .filter((feature) => feature.blockers.length === 0)
      .flatMap((feature) =>
        feature.calls.map((call) => helperName(helpers, call.verb, !isPublicRoute(helpers, call.route.staticPrefix))),
      ),
  );

  assertHelpersExist(tree, graph, helpers, neededHelpers);

  const existing = indexExistingCreators(tree, graph, helpers, visit);
  const ready: ToolkitFeature[] = [];
  let creatorsWritten = 0;
  let creatorsReused = 0;

  for (const feature of discovered.features) {
    if (feature.blockers.length > 0) {
      feature.blockers.forEach((blocker) => report.add(blocker));
      continue;
    }

    const storeFiles = new Set(
      [
        feature.files.actions,
        feature.files.reducer,
        feature.files.effects,
        feature.files.selectors,
        feature.files.service,
      ].filter((file): file is string => !!file),
    );

    let facadeContent: string | null = null;

    if (feature.files.facade) {
      const rewrite = rewriteFacade(tree.read(feature.files.facade, 'utf-8')!, feature, graph, storeFiles);

      if ('blockers' in rewrite) {
        rewrite.blockers.forEach((blocker) => report.add(blocker));
        continue;
      }

      facadeContent = rewrite.content;
    }

    const written = writeQueriesFile(tree, graph, feature, helpers, existing, report);

    creatorsWritten += written.written;
    creatorsReused += written.reused;

    if (feature.files.facade && facadeContent) tree.write(feature.files.facade, facadeContent);

    feature.warnings.forEach((warning) => report.add(warning));
    ready.push(feature);
  }

  const removal = removeFeatureStores(tree, graph, inScope, ready, report);
  const consumers = migrateToolkitConsumers(tree, createModuleGraph(tree), inScope, report);

  return {
    featuresFound: discovered.features.length,
    featuresConverted: ready.length,
    featuresSkipped: discovered.features.length - ready.length,
    storeFilesKept: removal.keptFeatures.length,
    creatorsWritten,
    creatorsReused,
    deletedFiles: removal.deletedFiles,
    consumers,
  };
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating @tomtomb/ngrx-toolkit stores to @ethlete/query...');

  const report = new ToolkitMigrationReport();
  const stats = migrateToolkitStores(tree, schema, report);

  console.log(
    `   ${stats.featuresConverted}/${stats.featuresFound} features converted, ${stats.creatorsWritten} creators written, ${stats.creatorsReused} reused, ${stats.deletedFiles.length} files deleted.`,
  );
  console.log(
    `   ${stats.consumers.filesRewritten} consumer files moved to @ethlete/query/ngrx-toolkit, ${stats.consumers.refreshSitesRewritten} refresh sites rewritten.`,
  );

  report.writeToTree(tree);
  report.printSummary();

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}
