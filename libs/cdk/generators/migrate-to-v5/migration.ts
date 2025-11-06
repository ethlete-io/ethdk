import { Tree, formatFiles } from '@nx/devkit';
import migrateCdkMenu from './cdk-menu';
import migrateColorThemes from './color-themes';
import { migrateCombobox } from './combobox';
import { migrateEtLet } from './et-let';

//#region Migration main

interface MigrationSchema {
  skipFormat?: boolean;
}

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting CDK v5 migration...');

  migrateCombobox(tree);
  migrateEtLet(tree);
  await migrateColorThemes(tree);
  await migrateCdkMenu(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
