import { Tree, formatFiles } from '@nx/devkit';
import { migrateDevtoolsUsage, migrateEmptyPrepareCalls, replaceAnyQueryWithLegacy } from './cleanup-migration.js';
import { reportDefaultHeaderUsages, reportMissingHttpClientProviders } from './http-client-check.js';
import { migrateLegacyPrepareCalls } from './legacy-prepare-migration.js';
import { createNewQueryCreators, updateLegacyCreatorImportsAndUsages } from './legacy-query-creator-migration.js';
import { MigrationScopeOptions, createMigrationScope } from './migration-scope.js';
import {
  generateProviderAliases,
  generateQueryCreators,
  migrateQueryClients,
  updateImportsAcrossWorkspace,
} from './query-client-migration.js';
import { QueryV3MigrationReport } from './report.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting query v3 migration...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const report = new QueryV3MigrationReport();
  const { queryClientFiles, variableRenames } = migrateQueryClients(tree, report, scope);

  if (queryClientFiles.size > 0) {
    generateProviderAliases(tree, queryClientFiles);
    generateQueryCreators(tree, queryClientFiles);
    createNewQueryCreators(tree, queryClientFiles, report, scope);
    updateLegacyCreatorImportsAndUsages(tree, scope, report);
  }

  if (variableRenames.size > 0) {
    updateImportsAcrossWorkspace(tree, variableRenames, scope);
  }

  replaceAnyQueryWithLegacy(tree, scope);
  migrateDevtoolsUsage(tree, scope, report);
  migrateEmptyPrepareCalls(tree, scope);
  migrateLegacyPrepareCalls(tree, report, scope);

  if (queryClientFiles.size > 0) {
    reportMissingHttpClientProviders(tree, report, scope);
    reportDefaultHeaderUsages(tree, report, scope);
  }

  report.writeToTree(tree);
  report.printSummary();

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Query v3 migration completed successfully!');
}
