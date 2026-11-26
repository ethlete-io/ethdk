import { Tree, formatFiles } from '@nx/devkit';

//#region Migration main

type MigrationSchema = {
  skipFormat?: boolean;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting dummy migration...');

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion
