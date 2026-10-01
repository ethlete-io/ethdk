import { Tree, joinPathFragments } from '@nx/devkit';
import { dirname } from 'path';
import * as ts from 'typescript';
import { MigrationScopeOptions, createMigrationScope } from '../migrate-to-query-v3/migration-scope.js';
import {
  MigrationTaskLocation,
  QUERY_V3_MIGRATION_REPORT_PATH,
  QueryV3MigrationReport,
} from '../migrate-to-query-v3/report.js';
import { createSourceFile, getLineNumber, getLineNumberFromPosition } from '../migrate-to-query-v3/shared.js';

type MigrationSchema = MigrationScopeOptions;

const SOURCE = 'report-legacy-query-apis';
const QUERY_PACKAGE = '@ethlete/query';
const DOCS_URL = 'https://ethlete-sdk-docs.web.app';

const GROUPS_DOCS = `${DOCS_URL}/query/groups`;
const COLLECTIONS_GUIDE = `${DOCS_URL}/query/migrating-from-v2#query-collections`;
const INFINITY_GUIDE = `${DOCS_URL}/query/migrating-from-v2#infinity-queries`;
const TRIGGER_DOCS = `${DOCS_URL}/components/paged-query-trigger`;
const ENTITY_GUIDE = `${DOCS_URL}/query/migrating-from-v2#entitystore-becomes-invalidates-and-tags`;
const CACHING_DOCS = `${DOCS_URL}/query/caching`;

const COLLECTION_FNS = ['createQueryCollection', 'createQueryCollectionSignal', 'createQueryCollectionSubject'];
const COLLECTION_STATE_FN = 'switchQueryCollectionState';
const INFINITY_CONFIG_FN = 'createInfinityQueryConfig';
const ENTITY_STORE_CLASS = 'EntityStore';
const LEGACY_CREATOR_FN = 'createLegacyQueryCreator';
const INFINITY_DIRECTIVE = 'InfinityQueryDirective';
const INFINITY_TRIGGER_DIRECTIVE = 'InfinityQueryTriggerDirective';

const INFINITY_DIRECTIVE_PATTERN = /\*etInfinityQuery(?![\w-])/g;
const INFINITY_TRIGGER_PATTERN = /(?<![\w-])etInfinityQueryTrigger(?![\w-])|<et-infinity-query-trigger(?![\w-])/g;

const ENTITY_ACTION =
  `Move every write into the store to \`invalidates\` on the mutation creator (${CACHING_DOCS}#invalidating-from-the-mutation) ` +
  `and \`tags\` on the reads it changes (${CACHING_DOCS}#tags), and add \`withOptimisticUpdate\` where the UI must change ` +
  `before the response (${CACHING_DOCS}#optimistic-updates) - see ${ENTITY_GUIDE}.`;

type QueryImports = {
  named: Map<string, string>;
  namespaces: Set<string>;
};

const isScannableFile = (filePath: string) => /\.(ts|mts|cts)$/.test(filePath) && !filePath.endsWith('.d.ts');

const collectQueryImports = (sourceFile: ts.SourceFile): QueryImports => {
  const named = new Map<string, string>();
  const namespaces = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== QUERY_PACKAGE
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;

    if (!bindings) continue;

    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
      continue;
    }

    for (const element of bindings.elements) {
      named.set(element.name.text, (element.propertyName ?? element.name).text);
    }
  }

  return { named, namespaces };
};

const importedNameOf = (expression: ts.Expression, imports: QueryImports) => {
  if (ts.isIdentifier(expression)) return imports.named.get(expression.text);

  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    imports.namespaces.has(expression.expression.text)
  ) {
    return expression.name.text;
  }

  return undefined;
};

const hasImported = (imports: QueryImports, exportName: string) =>
  imports.namespaces.size > 0 || [...imports.named.values()].includes(exportName);

const declaredNameOf = (node: ts.Node) => {
  const parent = node.parent;

  if (
    (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertyAssignment(parent)) &&
    parent.initializer === node &&
    (ts.isIdentifier(parent.name) || ts.isPrivateIdentifier(parent.name))
  ) {
    return parent.name.text;
  }

  return undefined;
};

const propertyNamed = (literal: ts.ObjectLiteralExpression, name: string) =>
  literal.properties.find(
    (property) =>
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name,
  );

const isEntityConfigCall = (call: ts.CallExpression, config: ts.ObjectLiteralExpression, imports: QueryImports) =>
  importedNameOf(call.expression, imports) === LEGACY_CREATOR_FN ||
  (ts.isPropertyAccessExpression(call.expression) && propertyNamed(config, 'route') !== undefined);

const scanSource = (options: {
  tree: Tree;
  filePath: string;
  sourceFile: ts.SourceFile;
  imports: QueryImports;
  report: QueryV3MigrationReport;
}) => {
  const { tree, filePath, sourceFile, imports, report } = options;
  const at = (node: ts.Node): MigrationTaskLocation[] => [{ filePath, line: getLineNumber(node, sourceFile) }];
  const keyOf = (kind: string, node: ts.Node) => `${SOURCE}:${kind}:${filePath}:${node.getStart(sourceFile)}`;

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const importedName = importedNameOf(node.expression, imports);
      const name = declaredNameOf(node);

      if (importedName && COLLECTION_FNS.includes(importedName)) {
        report.addFollowUp({
          title: `Replace the query collection ${name ?? importedName}`,
          summary: `${name ? `\`${name}\` is built with` : 'This call is'} \`${importedName}\`, a legacy query collection. v3 has no query collections.`,
          action: `Move an action set where the latest run wins to \`createQueryGroup\` (${GROUPS_DOCS}), a query picked by context to a \`computed\`, and an auth collection to \`createBearerAuthProvider\` - see ${COLLECTIONS_GUIDE}.`,
          locations: at(node),
          source: SOURCE,
          dedupeKey: keyOf('collection', node),
        });
      }

      if (importedName === COLLECTION_STATE_FN) {
        report.addFollowUp({
          title: `Replace switchQueryCollectionState()`,
          summary: `\`switchQueryCollectionState()\` reads the state of the query collection member that ran last.`,
          action: `Read \`succeeded$\`, \`loading()\` or \`error()\` of the query group that replaces the collection (${GROUPS_DOCS}) - see ${COLLECTIONS_GUIDE}.`,
          locations: at(node),
          source: SOURCE,
          dedupeKey: keyOf('collection-state', node),
        });
      }

      if (importedName === INFINITY_CONFIG_FN) {
        report.addFollowUp({
          title: `Replace the infinity query ${name ?? importedName}`,
          summary: `${name ? `\`${name}\` is built with` : 'This call is'} \`createInfinityQueryConfig\`, the legacy infinite query.`,
          action: `Move it to \`createPagedQueryStack\` and bind \`[etPagedQueryTrigger]\` to the stack (${TRIGGER_DOCS}) - see ${INFINITY_GUIDE}.`,
          locations: at(node),
          source: SOURCE,
          dedupeKey: keyOf('infinity-config', node),
        });
      }

      const [config] = node.arguments;

      if (config && ts.isObjectLiteralExpression(config) && isEntityConfigCall(node, config, imports)) {
        const entity = propertyNamed(config, 'entity');

        if (entity) {
          report.addFollowUp({
            title: `Replace the entity config of ${name ?? 'the query creator'}`,
            summary: `${name ? `\`${name}\` has` : 'This query creator has'} an \`entity\` config that writes its response into a legacy EntityStore. v3 has no entity store.`,
            action: ENTITY_ACTION,
            locations: at(entity),
            source: SOURCE,
            dedupeKey: keyOf('entity-config', entity),
          });
        }
      }
    }

    if (ts.isNewExpression(node) && importedNameOf(node.expression, imports) === ENTITY_STORE_CLASS) {
      const name = declaredNameOf(node);

      report.addFollowUp({
        title: `Replace the entity store ${name ?? ENTITY_STORE_CLASS}`,
        summary: `${name ? `\`${name}\` is` : 'This is'} a legacy \`EntityStore\`. v3 has no entity store.`,
        action: ENTITY_ACTION,
        locations: at(node),
        source: SOURCE,
        dedupeKey: keyOf('entity-store', node),
      });
    }

    if (ts.isDecorator(node)) {
      scanComponentTemplate({ tree, filePath, sourceFile, decorator: node, imports, report });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const scanComponentTemplate = (options: {
  tree: Tree;
  filePath: string;
  sourceFile: ts.SourceFile;
  decorator: ts.Decorator;
  imports: QueryImports;
  report: QueryV3MigrationReport;
}) => {
  const { tree, filePath, sourceFile, decorator, imports, report } = options;
  const usesDirective = hasImported(imports, INFINITY_DIRECTIVE);
  const usesTrigger = hasImported(imports, INFINITY_TRIGGER_DIRECTIVE);

  if (!usesDirective && !usesTrigger) return;

  const call = decorator.expression;

  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== 'Component') return;

  const [metadata] = call.arguments;

  if (!metadata || !ts.isObjectLiteralExpression(metadata)) return;

  const template = propertyNamed(metadata, 'template');
  const templateUrl = propertyNamed(metadata, 'templateUrl');
  let scanned: { text: string; filePath: string; firstLine: number } | undefined;

  if (
    template &&
    ts.isPropertyAssignment(template) &&
    (ts.isStringLiteral(template.initializer) || ts.isNoSubstitutionTemplateLiteral(template.initializer))
  ) {
    scanned = { text: template.initializer.text, filePath, firstLine: getLineNumber(template.initializer, sourceFile) };
  }

  if (
    templateUrl &&
    ts.isPropertyAssignment(templateUrl) &&
    (ts.isStringLiteral(templateUrl.initializer) || ts.isNoSubstitutionTemplateLiteral(templateUrl.initializer))
  ) {
    const templatePath = joinPathFragments(dirname(filePath), templateUrl.initializer.text);
    const text = tree.read(templatePath, 'utf-8');

    if (text !== null) scanned = { text, filePath: templatePath, firstLine: 1 };
  }

  if (!scanned) return;

  const { text, firstLine } = scanned;
  const templatePath = scanned.filePath;
  const matches = (pattern: RegExp) =>
    Array.from(text.matchAll(pattern), (match) => ({
      line: firstLine + getLineNumberFromPosition(text, match.index) - 1,
    }));

  if (usesDirective) {
    for (const { line } of matches(INFINITY_DIRECTIVE_PATTERN)) {
      report.addFollowUp({
        title: 'Replace *etInfinityQuery',
        summary: 'The template renders a legacy infinite query through `*etInfinityQuery`.',
        action: `Render the items of the paged query stack that replaces the config with \`@for (item of stack.items(); track item.id)\` - see ${INFINITY_GUIDE}.`,
        locations: [{ filePath: templatePath, line }],
        source: SOURCE,
        dedupeKey: `${SOURCE}:infinity-directive:${templatePath}:${line}`,
      });
    }
  }

  if (usesTrigger) {
    for (const { line } of matches(INFINITY_TRIGGER_PATTERN)) {
      report.addFollowUp({
        title: 'Replace etInfinityQueryTrigger with etPagedQueryTrigger',
        summary: '`etInfinityQueryTrigger` loads the next page of a legacy infinite query.',
        action: `Bind \`[etPagedQueryTrigger]\` to the paged query stack and drop the \`@if (canLoadMore && !loading)\` around it; a trigger on a button becomes \`(click)="stack.fetchNextPage()"\` with \`[etQueryButton]\` - see ${TRIGGER_DOCS}.`,
        locations: [{ filePath: templatePath, line }],
        source: SOURCE,
        dedupeKey: `${SOURCE}:infinity-trigger:${templatePath}:${line}`,
      });
    }
  }
};

export const reportLegacyQueryApis = (tree: Tree, scope: ReturnType<typeof createMigrationScope>) => {
  const report = new QueryV3MigrationReport();

  scope.visit(tree, (filePath) => {
    if (!isScannableFile(filePath)) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content || (!content.includes(QUERY_PACKAGE) && !content.includes('entity'))) return;

    const sourceFile = createSourceFile(content, filePath);

    scanSource({ tree, filePath, sourceFile, imports: collectQueryImports(sourceFile), report });
  });

  return report;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Reporting legacy query collections, infinity queries and entity stores...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const report = reportLegacyQueryApis(tree, scope);

  if (report.tasks.length === 0 && !tree.exists(QUERY_V3_MIGRATION_REPORT_PATH)) {
    console.log('   Nothing found.');

    return;
  }

  report.writeToTree(tree, `${SOURCE} in ${scope.describe()}`);
  report.printSummary();
}
