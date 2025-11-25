import { Tree, formatFiles } from '@nx/devkit';
import migrateCdkMenu from './cdk-menu.js';
import migrateColorThemes from './color-themes.js';
import { migrateCombobox } from './combobox.js';
import { migrateEtLet } from './et-let.js';
import migrateIsActiveElement from './is-active-element.js';
import migrateOverlayPositions from './overlay-positions.js';

//#region Migration main

type MigrationSchema = {
  skipFormat?: boolean;
  migrateCombobox?: boolean;
  migrateEtLet?: boolean;
  migrateColorThemes?: boolean;
  migrateCdkMenu?: boolean;
  migrateIsActiveElement?: boolean;
  migrateOverlayPositions?: boolean;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting CDK v5 migration...');

  const shouldMigrateCombobox = schema.migrateCombobox !== false;
  const shouldMigrateEtLet = schema.migrateEtLet !== false;
  const shouldMigrateColorThemes = schema.migrateColorThemes !== false;
  const shouldMigrateCdkMenu = schema.migrateCdkMenu !== false;
  const shouldMigrateIsActiveElement = schema.migrateIsActiveElement !== false;
  const shouldMigrateOverlayPositions = schema.migrateOverlayPositions !== false;

  if (shouldMigrateCombobox) {
    console.log('  • Migrating combobox...');
    migrateCombobox(tree);
  }

  if (shouldMigrateEtLet) {
    console.log('  • Migrating et-let...');
    migrateEtLet(tree);
  }

  if (shouldMigrateColorThemes) {
    console.log('  • Migrating color themes...');
    await migrateColorThemes(tree);
  }

  if (shouldMigrateCdkMenu) {
    console.log('  • Migrating cdk-menu...');
    await migrateCdkMenu(tree);
  }

  if (shouldMigrateIsActiveElement) {
    console.log('  • Migrating is-active-element...');
    await migrateIsActiveElement(tree);
  }

  if (shouldMigrateOverlayPositions) {
    console.log('  • Migrating overlay positions...');
    await migrateOverlayPositions(tree);
  }

  if (!schema.skipFormat) {
    console.log('  • Formatting files...');
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
