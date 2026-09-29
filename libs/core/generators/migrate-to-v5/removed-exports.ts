import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScope } from '../migrate-provider-shape/migration-scope.js';
import { collectFiles, TransformReport } from './migration-files.js';

const REMOVED_EXPORTS = new Map<string, string>([
  ...['Memo', 'MemoConfig', 'MemoResolver', 'MapLike'].map((name) => [name, 'the @Memo decorator'] as const),
  ...[
    'createProps',
    'createHostProps',
    'createPropHandlers',
    'createSetup',
    'createDependencyStash',
    'createElementDictionary',
    'bindProps',
    'unbindProps',
    'PropsDirective',
    'templateComputed',
    'ComponentType',
    'AnyTemplateType',
    'TemplateRefWithContext',
    'ComponentTypeWithInputs',
    'StringTemplate',
    'NgTemplateTemplate',
    'ComponentTemplate',
    'Props',
    'PropsAttachedElements',
    'PropsAttachedElementsInternal',
    'PropsInternal',
    'CreatePropsOptions',
    'HostProps',
    'PropHandlers',
    'BindPropsOptions',
    'UnbindPropsOptions',
  ].map((name) => [name, 'the props module'] as const),
]);

const ET_PROPS_ATTRIBUTE = /\betProps\b/;

export default async function reportRemovedExports(tree: Tree, scope?: MigrationScope): Promise<TransformReport> {
  const review: string[] = [];

  for (const filePath of collectFiles(tree, scope, ['.ts', '.html'])) {
    const messages = filePath.endsWith('.ts') ? findRemovedImports(tree, filePath) : findEtPropsUsage(tree, filePath);

    review.push(...messages.map((message) => `${filePath}: ${message}`));
  }

  return { filesChanged: 0, review };
}

function findRemovedImports(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('@ethlete/core')) return [];

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const messages: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;

    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || specifier.text !== '@ethlete/core') continue;

    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : statement.exportClause;
    if (!bindings || ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings)) continue;

    for (const element of bindings.elements) {
      const name = (element.propertyName ?? element.name).text;
      const origin = REMOVED_EXPORTS.get(name);

      if (origin) {
        messages.push(`${name} was removed from @ethlete/core together with ${origin} and has no replacement.`);
      }
    }
  }

  return messages;
}

function findEtPropsUsage(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !ET_PROPS_ATTRIBUTE.test(content)) return [];

  return ['[etProps] (PropsDirective) was removed from @ethlete/core together with the props module.'];
}
