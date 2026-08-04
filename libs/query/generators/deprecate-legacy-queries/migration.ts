import { Tree, formatFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScopeOptions, createMigrationScope } from '../migrate-to-query-v3/migration-scope.js';
import { addJsDocTag, createSourceFile, legacyQueryDeprecationTag } from '../migrate-to-query-v3/shared.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const CREATOR_FN = 'createLegacyQueryCreator';

type WrapperDeclaration = {
  statement: ts.VariableStatement;

  /** The v3 creator the wrapper forwards to, named in the tag so the call site knows its target. */
  creatorName?: string;
};

const isMigratableFile = (filePath: string) => /\.(ts|mts|cts)$/.test(filePath) && !filePath.endsWith('.d.ts');

const creatorNameOf = (call: ts.CallExpression, sourceFile: ts.SourceFile) => {
  const [options] = call.arguments;

  if (!options || !ts.isObjectLiteralExpression(options)) {
    return undefined;
  }

  const property = options.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && candidate.name.getText(sourceFile) === 'creator',
  );

  if (!property || !ts.isIdentifier(property.initializer)) {
    return undefined;
  }

  return property.initializer.text;
};

const collectWrappers = (sourceFile: ts.SourceFile) => {
  const wrappers: WrapperDeclaration[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === CREATOR_FN
    ) {
      const statement = node.parent.parent;

      // A wrapper declared inside a function body has no importable call sites to strike through.
      if (ts.isVariableStatement(statement) && ts.isSourceFile(statement.parent)) {
        wrappers.push({ statement, creatorName: creatorNameOf(node.initializer, sourceFile) });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return wrappers;
};

export const deprecateLegacyQueries = (tree: Tree, scope: ReturnType<typeof createMigrationScope>) => {
  let deprecatedWrappers = 0;
  let touchedFiles = 0;

  scope.visit(tree, (filePath) => {
    if (!isMigratableFile(filePath)) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content?.includes(CREATOR_FN)) return;

    const sourceFile = createSourceFile(content, filePath);
    const wrappers = collectWrappers(sourceFile);

    let nextContent = content;
    let tagged = 0;

    // Back to front, so an insertion never shifts the position the next wrapper was parsed at.
    for (const wrapper of wrappers.sort(
      (a, b) => b.statement.getStart(sourceFile) - a.statement.getStart(sourceFile),
    )) {
      const updated = addJsDocTag(
        nextContent,
        sourceFile,
        wrapper.statement,
        legacyQueryDeprecationTag(wrapper.creatorName),
      );

      if (updated === null) continue;

      nextContent = updated;
      tagged += 1;
    }

    if (tagged === 0) return;

    tree.write(filePath, nextContent);
    deprecatedWrappers += tagged;
    touchedFiles += 1;
  });

  return { deprecatedWrappers, touchedFiles };
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Deprecating legacy query wrappers...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const { deprecatedWrappers, touchedFiles } = deprecateLegacyQueries(tree, scope);

  console.log(
    `   Tagged ${deprecatedWrappers} wrapper${deprecatedWrappers === 1 ? '' : 's'} in ${touchedFiles} file${
      touchedFiles === 1 ? '' : 's'
    }.`,
  );

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Legacy query wrappers deprecated successfully!');
}
