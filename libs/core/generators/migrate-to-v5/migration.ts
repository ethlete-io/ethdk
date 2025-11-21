import { Tree, formatFiles } from '@nx/devkit';
import migrateCreateProvider from './create-provider.js';
import migrateViewportService from './viewport-service.js';

//#region Migration main

interface MigrationSchema {
  skipFormat?: boolean;
}

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting core v5 migration...');

  await migrateViewportService(tree);
  await migrateCreateProvider(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
