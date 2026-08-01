import { Tree, formatFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScopeOptions, createMigrationScope } from '../migrate-to-query-v3/migration-scope.js';
import { createSourceFile, ensureImportFromQuery, getLineNumber } from '../migrate-to-query-v3/shared.js';
import { QueryClientFeaturesMigrationReport } from './report.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const SOURCE = 'query-client-features';

type ClientEdit = {
  start: number;
  end: number;
  text: string;
  features: string[];
};

const isMigratableFile = (filePath: string) => /\.(ts|mts|cts)$/.test(filePath) && !filePath.endsWith('.d.ts');

const featureCallFor = (property: ts.PropertyAssignment | undefined, featureFn: string, sourceFile: ts.SourceFile) => {
  if (!property) return `${featureFn}()`;

  const value = property.initializer;

  if (value.kind === ts.SyntaxKind.FalseKeyword) return null;
  if (value.kind === ts.SyntaxKind.TrueKeyword) return `${featureFn}()`;

  return `${featureFn}(${value.getText(sourceFile)})`;
};

const collectClientEdits = (
  filePath: string,
  sourceFile: ts.SourceFile,
  report: QueryClientFeaturesMigrationReport,
) => {
  const edits: ClientEdit[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createQueryClient') {
      const [config] = node.arguments;
      const line = getLineNumber(node, sourceFile);

      if (!config || !ts.isObjectLiteralExpression(config)) {
        report.addManualReview({
          title: 'createQueryClient called with a non-literal config',
          summary:
            'The client config is not an object literal, so the codemod cannot tell whether it sets `multiTabSync` or `persistence`.',
          action:
            'Move the config inline, or replace the removed `multiTabSync` / `persistence` options with `features: [withMultiTabSync(), withQueryPersistence()]` by hand. Consider dropping a feature the app does not rely on instead — that removes the whole subsystem from the bundle.',
          locations: [{ filePath, line }],
          source: SOURCE,
          dedupeKey: 'non-literal-config',
        });
      } else if (config.properties.some((property) => ts.isSpreadAssignment(property))) {
        report.addManualReview({
          title: 'createQueryClient config spreads another object',
          summary: 'The spread may carry `multiTabSync` or `persistence`, which no longer exist on the client config.',
          action:
            'Check what the spread contributes and express it as `features: [withMultiTabSync(), withQueryPersistence()]` by hand. Consider dropping a feature the app does not rely on instead — that removes the whole subsystem from the bundle.',
          locations: [{ filePath, line }],
          source: SOURCE,
          dedupeKey: 'spread-config',
        });
      } else {
        const named = (name: string) =>
          config.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === name,
          );

        const syncProperty = named('multiTabSync');
        const persistenceProperty = named('persistence');
        const featuresProperty = named('features');

        if (featuresProperty) {
          report.addManualReview({
            title: 'createQueryClient already has a features array',
            summary: 'The client was left untouched so an existing `features` array is not overwritten.',
            action: 'Fold the removed `multiTabSync` / `persistence` options into the existing `features` array.',
            locations: [{ filePath, line }],
            source: SOURCE,
            dedupeKey: 'existing-features',
          });
        } else {
          for (const property of [syncProperty, persistenceProperty]) {
            const value = property?.initializer;

            if (!value) continue;

            if (
              value.kind === ts.SyntaxKind.TrueKeyword ||
              value.kind === ts.SyntaxKind.FalseKeyword ||
              ts.isObjectLiteralExpression(value)
            ) {
              continue;
            }

            report.addWarning({
              title: 'Client option value is not a literal',
              summary:
                'A `multiTabSync` / `persistence` value that is a variable or expression was passed through as the feature config, which is wrong if it can be a boolean.',
              action:
                'Check the value: a config object is fine as is, a boolean has to become a present or absent feature.',
              locations: [{ filePath, line }],
              source: SOURCE,
              dedupeKey: 'non-literal-option-value',
            });
          }

          const features = [
            featureCallFor(syncProperty, 'withMultiTabSync', sourceFile),
            featureCallFor(persistenceProperty, 'withQueryPersistence', sourceFile),
          ].filter((feature): feature is string => feature !== null);

          const kept = config.properties
            .filter((property) => property !== syncProperty && property !== persistenceProperty)
            .map((property) => property.getText(sourceFile));

          const properties = [...kept, ...(features.length > 0 ? [`features: [${features.join(', ')}]`] : [])];

          edits.push({
            start: config.getStart(sourceFile),
            end: config.getEnd(),
            text: `{ ${properties.join(', ')} }`,
            features,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return edits;
};

export const migrateQueryClientFeatures = (
  tree: Tree,
  report: QueryClientFeaturesMigrationReport,
  scope: ReturnType<typeof createMigrationScope>,
) => {
  let migratedClients = 0;

  scope.visit(tree, (filePath) => {
    if (!isMigratableFile(filePath)) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content?.includes('createQueryClient')) return;

    const sourceFile = createSourceFile(content, filePath);
    const edits = collectClientEdits(filePath, sourceFile, report);

    if (edits.length === 0) return;

    let nextContent = content;

    // Applied back to front so an earlier edit cannot shift a later one's offsets.
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      nextContent = nextContent.slice(0, edit.start) + edit.text + nextContent.slice(edit.end);
    }

    const importsNeeded = [...new Set(edits.flatMap((edit) => edit.features))]
      .map((feature) => feature.slice(0, feature.indexOf('(')))
      .sort();

    if (importsNeeded.length > 0) {
      nextContent = ensureImportFromQuery(nextContent, importsNeeded);
    }

    tree.write(filePath, nextContent);
    migratedClients += edits.length;
  });

  return { migratedClients };
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating query clients to opt-in features...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const report = new QueryClientFeaturesMigrationReport();
  const { migratedClients } = migrateQueryClientFeatures(tree, report, scope);

  console.log(`   Migrated ${migratedClients} query client${migratedClients === 1 ? '' : 's'}.`);

  report.writeToTree(tree);
  report.printSummary();

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Query client feature migration completed successfully!');
}
