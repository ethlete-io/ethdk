import { Tree, formatFiles } from '@nx/devkit';
import migrateViewportService from './viewport-service';

//#region Migration main

interface MigrationSchema {
  skipFormat?: boolean;
}

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting core v5 migration...');

  await migrateViewportService(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
