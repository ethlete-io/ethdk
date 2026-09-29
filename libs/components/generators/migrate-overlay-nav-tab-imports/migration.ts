import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { dirname } from 'node:path/posix';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { addOverlayNavTabImportsToFile, TEMPLATE_URL } from './overlay-nav-tab-imports.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateOverlayNavTabImports(tree: Tree, schema: MigrationSchema) {
  console.log(
    '\n🔎 Adding OVERLAY_NAV_TAB_IMPORTS where a NAV_TAB_IMPORTS component renders et-overlay-nav-tab-link...',
  );

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content?.includes('NAV_TAB_IMPORTS')) return;

    const templates = [...content.matchAll(TEMPLATE_URL)]
      .map((match) => tree.read(joinPathFragments(dirname(filePath), match[1] ?? ''), 'utf-8'))
      .filter((template): template is string => template !== null);

    const next = addOverlayNavTabImportsToFile(content, templates);
    if (next === null) return;

    tree.write(filePath, next);
    changed.push(filePath);
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Added OVERLAY_NAV_TAB_IMPORTS in ${changed.length} file(s).`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
