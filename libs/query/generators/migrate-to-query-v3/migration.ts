import { Tree, formatFiles } from '@nx/devkit';
import { migrateEmptyPrepareCalls, removeDevtoolsUsage, replaceAnyQueryWithLegacy } from './cleanup-migration.js';
import { migrateLegacyPrepareCalls } from './legacy-prepare-migration.js';
import { createNewQueryCreators, updateLegacyCreatorImportsAndUsages } from './legacy-query-creator-migration.js';
import {
  generateProviderAliases,
  generateQueryCreators,
  migrateQueryClients,
  updateImportsAcrossWorkspace,
} from './query-client-migration.js';
import { QueryV3MigrationReport } from './report.js';

type MigrationSchema = {
  skipFormat?: boolean;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting query v3 migration...');

  const report = new QueryV3MigrationReport();
  const { queryClientFiles, variableRenames } = migrateQueryClients(tree, report);

  if (queryClientFiles.size > 0) {
    generateProviderAliases(tree, queryClientFiles);
    generateQueryCreators(tree, queryClientFiles);
    createNewQueryCreators(tree, queryClientFiles, report);
    updateLegacyCreatorImportsAndUsages(tree);
  }

  if (variableRenames.size > 0) {
    updateImportsAcrossWorkspace(tree, variableRenames);
  }

  replaceAnyQueryWithLegacy(tree);
  removeDevtoolsUsage(tree);
  migrateEmptyPrepareCalls(tree);
  migrateLegacyPrepareCalls(tree, report);

  report.writeToTree(tree);
  report.printSummary();

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Query v3 migration completed successfully!');
}
