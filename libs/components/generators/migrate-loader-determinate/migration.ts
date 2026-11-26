import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { dirname } from 'node:path/posix';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { importsEthleteComponents, TEMPLATE_URL } from '../migrate-select-input-renames/select-input-renames.js';
import { LoaderFinding, migrateLoaderDeterminate } from './loader-determinate.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const CDK_SPINNER_IMPORT = /\bProgressSpinnerComponent\b[^;]*from\s*['"]@ethlete\/cdk/;

export default async function migrateLoaderDeterminateInputs(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Removing the spinner determinate and progress bar indeterminate inputs...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];
  const findings: (LoaderFinding & { filePath: string })[] = [];

  const migrate = (filePath: string, content: string, skipSpinner: boolean) => {
    const result = migrateLoaderDeterminate(content, { skipSpinner });

    findings.push(...result.findings.map((finding) => ({ ...finding, filePath })));

    if (result.content === null) return;

    tree.write(filePath, result.content);
    changed.push(filePath);
  };

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content || !importsEthleteComponents(content)) return;

    const skipSpinner = CDK_SPINNER_IMPORT.test(content);

    for (const match of content.matchAll(TEMPLATE_URL)) {
      const templatePath = joinPathFragments(dirname(filePath), match[1] ?? '');
      const template = tree.read(templatePath, 'utf-8');

      if (template !== null) migrate(templatePath, template, skipSpinner);
    }

    migrate(filePath, content, skipSpinner);
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  for (const finding of findings) {
    console.warn(`\n⚠️  ${finding.filePath}:${finding.line} ${finding.message} See /components/loader.`);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Migrated loader bindings in ${changed.length} file(s).`);
  } else if (findings.length === 0) {
    console.log('\n✅ Nothing to do.');
  }
}
