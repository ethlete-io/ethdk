import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import {
  callErrorColorTheme,
  collectErrorColorThemeReceivers,
  hasUncalledErrorColorTheme,
} from './error-color-theme-signal.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const componentSourcesOf = (tree: Tree, templatePath: string) => {
  const separator = templatePath.lastIndexOf('/');
  const directory = separator === -1 ? '' : templatePath.slice(0, separator);
  const templateName = templatePath.slice(separator + 1);

  return tree
    .children(directory)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
    .map((name) => tree.read(joinPathFragments(directory, name), 'utf-8') ?? '')
    .filter((source) => source.includes(templateName));
};

const receiversFor = (tree: Tree, filePath: string, content: string) => {
  const receivers = collectErrorColorThemeReceivers(content);

  if (filePath.endsWith('.html')) {
    for (const source of componentSourcesOf(tree, filePath)) {
      for (const name of collectErrorColorThemeReceivers(source)) receivers.add(name);
    }
  }

  return receivers;
};

export default async function migrateErrorColorThemeSignal(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Calling the errorColorTheme signal of injectFormSupport() and TableComponent...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content?.includes('errorColorTheme')) return;

    const receivers = receiversFor(tree, filePath, content);
    const next = callErrorColorTheme(content, receivers);

    if (next !== null) {
      tree.write(filePath, next);
      changed.push(filePath);
    }

    if (receivers.size > 0 && hasUncalledErrorColorTheme(next ?? content)) {
      console.warn(
        `\n⚠️  ${filePath} still reads an errorColorTheme it could not tie to injectFormSupport() or a TableComponent. If it is one of those, call it: errorColorTheme().`,
      );
    }
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Called errorColorTheme in ${changed.length} file(s).`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
