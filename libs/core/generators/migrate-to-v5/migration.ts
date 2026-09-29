import { Tree, formatFiles, logger } from '@nx/devkit';
import {
  createMigrationScope,
  MigrationScope,
  MigrationScopeOptions,
} from '../migrate-provider-shape/migration-scope.js';
import migrateColorNaming from './color-naming.js';
import migrateCreateProvider from './create-provider.js';
import { TransformReport } from './migration-files.js';
import reportRemovedExports from './removed-exports.js';
import migrateRouterStateService from './router-state-service.js';
import migrateViewportService from './viewport-service.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
  migrateViewportService?: boolean;
  migrateCreateProvider?: boolean;
  migrateRouterStateService?: boolean;
  migrateColorNaming?: boolean;
  reportRemovedExports?: boolean;
};

type Transform = {
  label: string;
  enabled: boolean;
  run: (tree: Tree, scope: MigrationScope) => Promise<TransformReport>;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  const scope = createMigrationScope(tree, schema);

  logger.info('\n🔄 Starting core v5 migration...');
  logger.info(`   Scope: ${scope.describe()}`);

  const transforms: Transform[] = [
    { label: 'ViewportService', enabled: schema.migrateViewportService !== false, run: migrateViewportService },
    { label: 'createProvider', enabled: schema.migrateCreateProvider !== false, run: migrateCreateProvider },
    {
      label: 'RouterStateService',
      enabled: schema.migrateRouterStateService !== false,
      run: migrateRouterStateService,
    },
    { label: 'Theme → color naming', enabled: schema.migrateColorNaming !== false, run: migrateColorNaming },
    { label: 'Removed exports', enabled: schema.reportRemovedExports !== false, run: reportRemovedExports },
  ];

  const reports: [string, TransformReport][] = [];

  for (const transform of transforms) {
    if (!transform.enabled) continue;

    logger.info(`  • ${transform.label}...`);
    reports.push([transform.label, await transform.run(tree, scope)]);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.info('\nSummary:');

  for (const [label, report] of reports) {
    const review = report.review.length > 0 ? `, ${report.review.length} to review manually` : '';

    logger.info(`  • ${label}: ${report.filesChanged} file(s) changed${review}`);

    for (const message of report.review) {
      logger.warn(`    ⚠ ${message}`);
    }
  }

  logger.info('\n✅ Migration completed. Review the diff before committing.');
}
