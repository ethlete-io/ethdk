// @ts-check
'use strict';

const { formatFiles, visitNotIgnoredFiles } = require('@nx/devkit');
const { restoreModuleAugmentationInterfaces } = require('./restore-module-augmentation-interfaces');

const SOURCE_FILE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/;

/**
 * @param {import('@nx/devkit').Tree} tree
 * @param {{ skipFormat?: boolean }} schema
 */
const migrateModuleAugmentationInterfaces = async (tree, schema) => {
  console.log('\n🔄 Restoring module augmentation interfaces...');

  let filesChanged = 0;
  let reviewCount = 0;

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!SOURCE_FILE.test(filePath)) return;

    const before = tree.read(filePath, 'utf-8');

    if (!before) return;

    const result = restoreModuleAugmentationInterfaces(filePath, before);

    for (const entry of result.review) {
      reviewCount++;
      console.warn(
        `   ⚠ ${filePath}:${entry.line}: type ${entry.name} in a module augmentation is not an object literal, so it was left alone. An augmentation only merges as an interface.`,
      );
    }

    if (!result.changed) return;

    tree.write(filePath, result.content);
    filesChanged++;
    console.log(`   ✓ ${filePath}`);
  });

  console.log(filesChanged === 0 ? '   Nothing to migrate.\n' : `\n✅ Migrated ${filesChanged} file(s).\n`);

  if (reviewCount > 0) console.warn(`   Review ${reviewCount} type alias(es) in module augmentations manually.\n`);

  if (!schema.skipFormat) await formatFiles(tree);
};

module.exports = migrateModuleAugmentationInterfaces;
module.exports.default = migrateModuleAugmentationInterfaces;
