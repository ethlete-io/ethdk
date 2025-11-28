import { Tree, formatFiles } from '@nx/devkit';
import migrateCreateProvider from './create-provider.js';
import migrateRouterStateService from './router-state-service.js';
import migrateViewportService from './viewport-service.js';

//#region Migration main

type MigrationSchema = {
  skipFormat?: boolean;
  migrateViewportService?: boolean;
  migrateCreateProvider?: boolean;
  migrateRouterStateService?: boolean;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting core v5 migration...');

  const shouldMigrateViewportService = schema.migrateViewportService !== false;
  const shouldMigrateCreateProvider = schema.migrateCreateProvider !== false;
  const shouldMigrateRouterStateService = schema.migrateRouterStateService !== false;

  if (shouldMigrateViewportService) {
    console.log('  • Migrating viewport service...');
    await migrateViewportService(tree);
  }

  if (shouldMigrateCreateProvider) {
    console.log('  • Migrating create provider...');
    await migrateCreateProvider(tree);
  }

  if (shouldMigrateRouterStateService) {
    await migrateRouterStateService(tree);
  }

  if (!schema.skipFormat) {
    console.log('  • Formatting files...');
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
