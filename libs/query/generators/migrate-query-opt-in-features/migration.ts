import { Tree, formatFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScopeOptions, createMigrationScope } from '../migrate-to-query-v3/migration-scope.js';
import { createSourceFile, ensureImportFromQuery, getLineNumber } from '../migrate-to-query-v3/shared.js';
import { QueryOptInFeaturesMigrationReport } from './report.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
  reportOnly?: boolean;
};

const SOURCE = 'query-opt-in-features';

const CLIENT_FEATURE = 'withEthleteApiErrors';
const AUTH_FEATURE = 'withBearerAuthMultiTabSync';

type ConfigEdit = {
  start: number;
  end: number;
  text: string;
  features: string[];
};

const isMigratableFile = (filePath: string) => /\.(ts|mts|cts)$/.test(filePath) && !filePath.endsWith('.d.ts');

const propertyNamed = (config: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile, name: string) =>
  config.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === name,
  );

/** `{ enabled: false, channelName: 'x' }` -> `withBearerAuthMultiTabSync({ channelName: 'x' })`, or `null` when off. */
const authFeatureCallFor = (property: ts.PropertyAssignment | undefined, sourceFile: ts.SourceFile) => {
  if (!property) return `${AUTH_FEATURE}()`;

  const value = property.initializer;

  if (value.kind === ts.SyntaxKind.FalseKeyword) return null;
  if (value.kind === ts.SyntaxKind.TrueKeyword) return `${AUTH_FEATURE}()`;

  if (ts.isObjectLiteralExpression(value)) {
    const enabled = propertyNamed(value, sourceFile, 'enabled');

    if (enabled?.initializer.kind === ts.SyntaxKind.FalseKeyword) return null;

    const kept = value.properties.filter((entry) => entry !== enabled).map((entry) => entry.getText(sourceFile));

    return kept.length > 0 ? `${AUTH_FEATURE}({ ${kept.join(', ')} })` : `${AUTH_FEATURE}()`;
  }

  return `${AUTH_FEATURE}(${value.getText(sourceFile)})`;
};

const withFeatureAdded = (
  config: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  removed: ts.PropertyAssignment | undefined,
  feature: string | null,
) => {
  const featuresProperty = propertyNamed(config, sourceFile, 'features');
  const properties: string[] = [];

  for (const property of config.properties) {
    if (property === removed) continue;

    if (property === featuresProperty && feature) {
      const existing = featuresProperty.initializer;
      const entries = ts.isArrayLiteralExpression(existing)
        ? existing.elements.map((element) => element.getText(sourceFile))
        : [`...${existing.getText(sourceFile)}`];

      properties.push(`features: [${[...entries, feature].join(', ')}]`);
      continue;
    }

    properties.push(property.getText(sourceFile));
  }

  if (!featuresProperty && feature) properties.push(`features: [${feature}]`);

  return `{ ${properties.join(', ')} }`;
};

const collectEdits = (filePath: string, sourceFile: ts.SourceFile, report: QueryOptInFeaturesMigrationReport) => {
  const edits: ConfigEdit[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      const isClient = callee === 'createQueryClient';
      const isAuth = callee === 'createBearerAuthProvider';

      if (isClient || isAuth) {
        const [config] = node.arguments;
        const line = getLineNumber(node, sourceFile);

        if (!config || !ts.isObjectLiteralExpression(config)) {
          report.addManualReview({
            title: `${callee} called with a non-literal config`,
            summary: 'The config is not an object literal, so the codemod cannot add the opt-in feature to it.',
            action: `Add \`${isClient ? CLIENT_FEATURE : AUTH_FEATURE}()\` to the config's \`features\` array by hand, or drop the behavior if the app does not rely on it.`,
            locations: [{ filePath, line }],
            source: SOURCE,
            dedupeKey: `non-literal-config:${callee}`,
          });
        } else if (config.properties.some((property) => ts.isSpreadAssignment(property))) {
          report.addManualReview({
            title: `${callee} config spreads another object`,
            summary: 'The spread may already carry `features`, or the removed `multiTabSync` option.',
            action: `Check what the spread contributes and add \`${isClient ? CLIENT_FEATURE : AUTH_FEATURE}()\` to the resulting \`features\` array by hand.`,
            locations: [{ filePath, line }],
            source: SOURCE,
            dedupeKey: `spread-config:${callee}`,
          });
        } else if (isClient) {
          const feature = `${CLIENT_FEATURE}()`;

          report.addFollowUp({
            title: 'Client kept the full error pipeline',
            summary: `\`${CLIENT_FEATURE}()\` was added so error parsing and retrying keep working exactly as before.`,
            action:
              'Narrow it: `withHtmlErrorParsing()` only for an API behind a proxy that answers HTML, `withSymfonyErrors()` only for violation-list responses, `withDefaultRetry()` only if failed requests should retry themselves.',
            locations: [{ filePath, line }],
            source: SOURCE,
            dedupeKey: 'client-error-pipeline',
          });

          edits.push({
            start: config.getStart(sourceFile),
            end: config.getEnd(),
            text: withFeatureAdded(config, sourceFile, undefined, feature),
            features: [feature],
          });
        } else {
          const syncProperty = propertyNamed(config, sourceFile, 'multiTabSync');
          const value = syncProperty?.initializer;

          if (
            value &&
            value.kind !== ts.SyntaxKind.TrueKeyword &&
            value.kind !== ts.SyntaxKind.FalseKeyword &&
            !ts.isObjectLiteralExpression(value)
          ) {
            report.addWarning({
              title: 'multiTabSync value is not a literal',
              summary:
                'A `multiTabSync` value that is a variable or expression was passed through as the feature config, which is wrong if it can be a boolean.',
              action:
                'Check the value: a config object is fine as is, a boolean has to become a present or absent feature.',
              locations: [{ filePath, line }],
              source: SOURCE,
              dedupeKey: 'non-literal-multi-tab-sync',
            });
          }

          const feature = authFeatureCallFor(syncProperty, sourceFile);

          if (feature) {
            report.addFollowUp({
              title: 'Auth provider kept multi-tab sync',
              summary: `\`${AUTH_FEATURE}()\` was added so cross-tab login/logout and leader election keep working as before.`,
              action:
                'Drop it if the app is only ever open in one tab (a kiosk, an embedded webview) - that removes the BroadcastChannel sync and the Web Locks leader election from the bundle.',
              locations: [{ filePath, line }],
              source: SOURCE,
              dedupeKey: 'auth-multi-tab-sync',
            });
          }

          edits.push({
            start: config.getStart(sourceFile),
            end: config.getEnd(),
            text: withFeatureAdded(config, sourceFile, syncProperty, feature),
            features: feature ? [feature] : [],
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return edits;
};

export const migrateQueryOptInFeatures = (
  tree: Tree,
  report: QueryOptInFeaturesMigrationReport,
  scope: ReturnType<typeof createMigrationScope>,
  { reportOnly = false }: { reportOnly?: boolean } = {},
) => {
  let migratedSites = 0;

  scope.visit(tree, (filePath) => {
    if (!isMigratableFile(filePath)) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content?.includes('createQueryClient') && !content?.includes('createBearerAuthProvider')) return;

    const sourceFile = createSourceFile(content as string, filePath);
    const edits = collectEdits(filePath, sourceFile, report);

    if (edits.length === 0) return;

    migratedSites += edits.length;

    if (reportOnly) return;

    let nextContent = content as string;

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
  });

  return { migratedSites };
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  const reportOnly = schema.reportOnly ?? false;

  console.log(`\n🔄 ${reportOnly ? 'Reporting' : 'Migrating'} query clients and auth providers to opt-in features...`);

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const report = new QueryOptInFeaturesMigrationReport();
  const { migratedSites } = migrateQueryOptInFeatures(tree, report, scope, { reportOnly });

  console.log(
    `   ${reportOnly ? 'Found' : 'Migrated'} ${migratedSites} call site${migratedSites === 1 ? '' : 's'}.${
      reportOnly ? ' No files were changed.' : ''
    }`,
  );

  report.writeToTree(tree);
  report.printSummary();

  if (!schema.skipFormat && !reportOnly) {
    await formatFiles(tree);
  }

  console.log('\n✅ Query opt-in feature migration completed successfully!');
}
