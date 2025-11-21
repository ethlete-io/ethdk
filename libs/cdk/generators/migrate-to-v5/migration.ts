import { Tree, formatFiles } from '@nx/devkit';
import migrateCdkMenu from './cdk-menu.js';
import migrateColorThemes from './color-themes.js';
import { migrateCombobox } from './combobox.js';
import { migrateEtLet } from './et-let.js';
import migrateIsActiveElement from './is-active-element.js';

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
  await migrateIsActiveElement(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
