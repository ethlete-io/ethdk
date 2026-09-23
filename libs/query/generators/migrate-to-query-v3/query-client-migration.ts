import { Tree } from '@nx/devkit';
import { MigrationScope } from './migration-scope.js';
import * as ts from 'typescript';
import { QueryV3MigrationReport } from './report.js';
import {
  capitalizeFirstLetter,
  createSourceFile,
  ensureConfigSuffix,
  ensureImportFromEthleteCore,
  ensureImportFromQuery,
  getVariableStatementEnd,
} from './shared.js';

export type QueryClientMigrationResult = {
  queryClientFiles: Map<string, string[]>;
  variableRenames: Map<string, string>;
};

type MigrateSingleClientOptions = {
  content: string;
  filePath: string;
  renamesOut?: Map<string, string>;
  report: QueryV3MigrationReport;
};

export const migrateQueryClients = (
  tree: Tree,
  report: QueryV3MigrationReport,
  scope: MigrationScope,
): QueryClientMigrationResult => {
  const queryClientFiles = new Map<string, string[]>();
  const variableRenames = new Map<string, string>();

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content || !hasQueryClientInstantiation(content)) {
      return;
    }

    const renames = new Map<string, string>();
    const nextContent = migrateQueryClientToConfig({ content, filePath, renamesOut: renames, report });

    renames.forEach((newName, oldName) => {
      variableRenames.set(oldName, newName);
    });

    const configNames = extractClientConfigNames(nextContent);

    if (configNames.length > 0) {
      queryClientFiles.set(filePath, configNames);
    }

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
    }
  });

  if (queryClientFiles.size > 0) {
    console.log('\n✅ Migrated QueryClient instantiations in:');
    queryClientFiles.forEach((configNames, filePath) => {
      console.log(`   - ${filePath} (${configNames.join(', ')})`);
    });
  }

  return { queryClientFiles, variableRenames };
};

export const generateProviderAliases = (tree: Tree, queryClientFiles: Map<string, string[]>) => {
  const updatedFiles: string[] = [];

  for (const [filePath, configNames] of queryClientFiles.entries()) {
    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      continue;
    }

    const nextContent = addProviderAliasesToFile(content, configNames);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      updatedFiles.push(filePath);
    }
  }

  if (updatedFiles.length > 0) {
    console.log('\n✅ Generated query client provider aliases in:');
    updatedFiles.forEach((filePath) => console.log(`   - ${filePath}`));
  }
};

export const generateQueryCreators = (tree: Tree, queryClientFiles: Map<string, string[]>) => {
  const generatedFiles: string[] = [];

  for (const [filePath, configNames] of queryClientFiles.entries()) {
    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      continue;
    }

    const nextContent = addQueryCreatorsToFile(content, configNames);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      generatedFiles.push(filePath);
    }
  }

  if (generatedFiles.length > 0) {
    console.log('\n✅ Generated query creators in:');
    generatedFiles.forEach((filePath) => console.log(`   - ${filePath}`));
  }
};

export const updateImportsAcrossWorkspace = (tree: Tree, renames: Map<string, string>, scope: MigrationScope) => {
  if (renames.size === 0) {
    return;
  }

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    const nextContent = updateImportsInFile(content, renames);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
    }
  });
};

const hasQueryClientInstantiation = (content: string) => {
  const sourceFile = createSourceFile(content);
  let hasQueryClientImport = false;
  let hasNewQueryClient = false;

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query' &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const hasLegacyClientImport = node.importClause.namedBindings.elements.some((element) => {
        return element.name.text === 'V2QueryClient';
      });

      if (hasLegacyClientImport) {
        hasQueryClientImport = true;
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'V2QueryClient') {
      hasNewQueryClient = true;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return hasQueryClientImport && hasNewQueryClient;
};

const migrateQueryClientToConfig = ({ content, filePath, renamesOut, report }: MigrateSingleClientOptions) => {
  const sourceFile = createSourceFile(content, filePath);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const variableRenames = new Map<string, string>();
  let hasUnmigratedClient = false;

  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'V2QueryClient') {
      const configArgument = node.arguments?.[0];

      if (!configArgument || !ts.isObjectLiteralExpression(configArgument)) {
        hasUnmigratedClient = true;

        report.addManualReview({
          title: 'Migrate a V2QueryClient whose config is not an object literal',
          summary: `\`${node.getText(sourceFile)}\` passes its config indirectly, so the migration cannot read it and left the client on v2.`,
          action:
            'Inline the config object and re-run the migration, or rewrite the client by hand as `createQueryClient({ baseUrl, name })` with provider aliases and creators.',
          locations: [{ filePath, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 }],
          source: 'query-client-migration',
          dedupeKey: `unmigrated-client:${filePath}:${node.getStart(sourceFile)}`,
        });
      } else {
        const oldVariableName = getVariableNameForQueryClient(node);
        const newVariableName = oldVariableName && ensureConfigSuffix(oldVariableName);

        if (oldVariableName && newVariableName && oldVariableName !== newVariableName) {
          const collisionRegex = new RegExp(`\\b(?:const|let|var)\\s+${newVariableName}\\b`);

          if (collisionRegex.test(content)) {
            report.addWarning({
              title: `Resolve query client rename collision for ${oldVariableName}`,
              summary: `The migration renamed ${oldVariableName} to ${newVariableName}, but a declaration with the target name already exists.`,
              action: `Verify the declarations in ${filePath} and rename one side manually before shipping the migrated client.`,
              locations: [{ filePath }],
              source: 'query-client-migration',
              dedupeKey: `rename-collision:${filePath}:${oldVariableName}:${newVariableName}`,
            });
          }

          variableRenames.set(oldVariableName, newVariableName);

          if (renamesOut) {
            renamesOut.set(oldVariableName, newVariableName);
          }
        }

        reportDroppedClientOptions({ configArgument, sourceFile, filePath, report });

        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: migrateConfigObject(configArgument, node, sourceFile),
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  result = removeQueryClientImport(result, hasUnmigratedClient);

  return renameVariables(result, variableRenames);
};

const removeQueryClientImport = (content: string, keepLegacyClient: boolean) => {
  const sourceFile = createSourceFile(content);
  let queryImportNode: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      !queryImportNode &&
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query' &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some((element) => element.name.text === 'V2QueryClient')
    ) {
      queryImportNode = node;
    }
  });

  const requiredImports = [
    'createDeleteQuery',
    'createGetQuery',
    'createPatchQuery',
    'createPostQuery',
    'createPutQuery',
    'createQueryClient',
  ];

  if (!queryImportNode?.importClause?.namedBindings || !ts.isNamedImports(queryImportNode.importClause.namedBindings)) {
    return ensureImportFromQuery(content, requiredImports);
  }

  const existingElements = queryImportNode.importClause.namedBindings.elements.filter((element) => {
    return keepLegacyClient || element.name.text !== 'V2QueryClient';
  });

  const nextImports = new Set<string>(requiredImports);
  existingElements.forEach((element) => nextImports.add(element.getText(sourceFile)));

  const nextImportStatement = `import { ${Array.from(nextImports).sort().join(', ')} } from '@ethlete/query';`;

  return (
    content.slice(0, queryImportNode.getStart(sourceFile)) +
    nextImportStatement +
    content.slice(queryImportNode.getEnd())
  );
};

const renameVariables = (content: string, renames: Map<string, string>) => {
  if (renames.size === 0) {
    return content;
  }

  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const nextName = renames.get(node.name.text);

      if (nextName) {
        replacements.push({
          start: node.name.getStart(sourceFile),
          end: node.name.getEnd(),
          replacement: nextName,
        });
      }
    } else if (ts.isIdentifier(node)) {
      const nextName = renames.get(node.text);

      if (nextName) {
        const parent = node.parent;

        if (!ts.isPropertyAssignment(parent) || parent.name !== node) {
          replacements.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            replacement: nextName,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const seen = new Set<string>();
  const uniqueReplacements = replacements.filter((replacement) => {
    const key = `${replacement.start}:${replacement.end}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });

  let result = content;

  uniqueReplacements.sort((left, right) => right.start - left.start);

  uniqueReplacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return result;
};

/**
 * What each v2 client option turns into, or why it has nowhere to go.
 *
 * Silently dropping these is how two apps here lost their default headers without a single warning.
 * A dropped option that shows up in the report is a five-minute fix; one that doesn't is a bug
 * report from production.
 */
const DROPPED_CLIENT_OPTIONS: Record<string, string> = {
  'request.autoRefreshQueriesOnWindowFocus':
    'No direct equivalent. Re-run the affected queries yourself - `withAutoRefresh({ onSignalChanges: [windowFocusSignal] })` per query, or `injectMyClient().refreshQueriesInUse()` from a focus listener.',
  'request.enableSmartPolling':
    'No direct equivalent. `withPolling({ interval })` polls unconditionally; pause it yourself when the tab is hidden if that matters.',
  'logging.preparedQuerySubscriptions':
    'Removed. Use the v3 devtools (`provideQueryDevtools()`) or `withLogging({ logFn })` on the queries you want to trace.',
  'logging.queryStateChanges':
    'Removed. Use the v3 devtools (`provideQueryDevtools()`) or `withLogging({ logFn })` on the queries you want to trace.',
  'request.autoRefreshOn':
    'No direct equivalent. Re-run the affected queries yourself with `withAutoRefresh` or `refreshQueriesInUse()`.',
};

type ReportDroppedClientOptionsInput = {
  configArgument: ts.ObjectLiteralExpression;
  sourceFile: ts.SourceFile;
  filePath: string;
  report: QueryV3MigrationReport;
};

const reportDroppedClientOptions = ({
  configArgument,
  sourceFile,
  filePath,
  report,
}: ReportDroppedClientOptionsInput) => {
  const migrated = new Set(['baseRoute', 'queryParams', 'cacheAdapter', 'retryFn', 'request', 'logging']);

  const raise = (optionPath: string, node: ts.Node) => {
    report.addWarning({
      title: `Reconfigure dropped query client option "${optionPath}"`,
      summary: `The v2 client option \`${optionPath}\` has no place in \`createQueryClient\` and was dropped by the migration.`,
      action: DROPPED_CLIENT_OPTIONS[optionPath] ?? 'Check whether the behaviour is still needed and reimplement it.',
      locations: [{ filePath, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 }],
      source: 'query-client-migration',
      dedupeKey: `dropped-client-option:${filePath}:${optionPath}`,
    });
  };

  const raiseSpread = (spread: ts.SpreadAssignment) => {
    const text = spread.getText(sourceFile);

    report.addWarning({
      title: `Reconfigure spread query client options "${text}"`,
      summary: `The v2 client config spreads \`${text}\`. The migration cannot see which options it holds, so none of them were carried over to \`createQueryClient\`.`,
      action:
        'Inline the spread options that are still needed (`baseRoute` becomes `baseUrl`) and re-check the result.',
      locations: [{ filePath, line: sourceFile.getLineAndCharacterOfPosition(spread.getStart(sourceFile)).line + 1 }],
      source: 'query-client-migration',
      dedupeKey: `dropped-client-spread:${filePath}:${spread.getStart(sourceFile)}`,
    });
  };

  configArgument.properties.forEach((property) => {
    if (ts.isSpreadAssignment(property)) {
      raiseSpread(property);

      return;
    }

    if (
      (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
      !ts.isIdentifier(property.name)
    ) {
      return;
    }

    const name = property.name.text;

    if (
      (name === 'request' || name === 'logging') &&
      ts.isPropertyAssignment(property) &&
      ts.isObjectLiteralExpression(property.initializer)
    ) {
      property.initializer.properties.forEach((nested) => {
        if (ts.isSpreadAssignment(nested)) {
          raiseSpread(nested);

          return;
        }

        if (
          (!ts.isPropertyAssignment(nested) && !ts.isShorthandPropertyAssignment(nested)) ||
          !ts.isIdentifier(nested.name)
        ) {
          return;
        }

        if (name === 'request' && ['queryParams', 'cacheAdapter', 'retryFn'].includes(nested.name.text)) {
          return;
        }

        raise(`${name}.${nested.name.text}`, nested);
      });

      return;
    }

    if (!migrated.has(name)) {
      raise(name, property);
    }
  });
};

const getPropertyValueText = (property: ts.ObjectLiteralElementLike, sourceFile: ts.SourceFile) => {
  if (ts.isShorthandPropertyAssignment(property)) {
    return property.name.text;
  }

  return ts.isPropertyAssignment(property) ? property.initializer.getText(sourceFile) : undefined;
};

const findProperty = (objectLiteral: ts.ObjectLiteralExpression, name: string) =>
  objectLiteral.properties.find((property) => {
    return (
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name
    );
  });

const migrateConfigObject = (configArgument: ts.ObjectLiteralExpression, node: ts.Node, sourceFile: ts.SourceFile) => {
  const variableName = getVariableNameForQueryClient(node) ?? 'client';
  const nextConfig: string[] = [];

  const baseRouteProperty = findProperty(configArgument, 'baseRoute');
  const baseRouteText = baseRouteProperty && getPropertyValueText(baseRouteProperty, sourceFile);

  if (baseRouteText) {
    nextConfig.push(`baseUrl: ${baseRouteText.replace('as `https://${string}`', '').trim()}`);
  }

  nextConfig.push(`name: '${variableName}'`);

  const requestProperty = findProperty(configArgument, 'request');

  if (
    requestProperty &&
    ts.isPropertyAssignment(requestProperty) &&
    ts.isObjectLiteralExpression(requestProperty.initializer)
  ) {
    const requestConfig = requestProperty.initializer;

    for (const [from, to] of [
      ['queryParams', 'queryString'],
      ['cacheAdapter', 'cacheAdapter'],
      ['retryFn', 'retryFn'],
    ] as const) {
      const property = findProperty(requestConfig, from);
      const valueText = property && getPropertyValueText(property, sourceFile);

      if (valueText) {
        nextConfig.push(`${to}: ${valueText}`);
      }
    }
  }

  return `createQueryClient({\n  ${nextConfig.join(',\n  ')}\n})`;
};

const getVariableNameForQueryClient = (node: ts.Node): string | undefined => {
  let parent = node.parent;

  while (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    parent = parent.parent;
  }

  return undefined;
};

const extractClientConfigNames = (content: string) => {
  const sourceFile = createSourceFile(content);
  const configNames: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'createQueryClient'
    ) {
      const configArgument = node.initializer.arguments[0];

      if (!configArgument || !ts.isObjectLiteralExpression(configArgument)) {
        ts.forEachChild(node, visit);
        return;
      }

      const nameProperty = configArgument.properties.find((property) => {
        return ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'name';
      });

      if (nameProperty && ts.isPropertyAssignment(nameProperty) && ts.isStringLiteral(nameProperty.initializer)) {
        configNames.push(nameProperty.initializer.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return configNames;
};

const addProviderAliasesToFile = (content: string, configNames: string[]) => {
  const sourceFile = createSourceFile(content);
  const insertions: Array<{ position: number; text: string }> = [];
  let result = content;

  configNames.forEach((configName) => {
    const variableName = ensureConfigSuffix(configName);
    const position = getVariableStatementEnd(sourceFile, variableName, 'createQueryClient');

    if (!position) {
      return;
    }

    const { injectName, provideName } = getProviderAliasNames(variableName);

    if (result.includes(`export const ${injectName} = toInjectFn(${variableName});`)) {
      return;
    }

    insertions.push({
      position,
      text:
        `\n\nexport const ${provideName} = toProvideFn(${variableName});` +
        `\nexport const ${injectName} = toInjectFn(${variableName});`,
    });
  });

  insertions.sort((left, right) => right.position - left.position);

  insertions.forEach(({ position, text }) => {
    result = result.slice(0, position) + text + result.slice(position);
  });

  return insertions.length > 0 ? ensureImportFromEthleteCore(result, ['toInjectFn', 'toProvideFn']) : result;
};

const getProviderAliasNames = (configVariableName: string) => {
  const baseName = configVariableName.replace(/Config$/, '');
  const capitalizedBaseName = capitalizeFirstLetter(baseName);

  return {
    provideName: `provide${capitalizedBaseName}`,
    injectName: `inject${capitalizedBaseName}`,
  };
};

const addQueryCreatorsToFile = (content: string, configNames: string[]) => {
  const sourceFile = createSourceFile(content);
  const insertions: Array<{ position: number; text: string }> = [];
  let result = content;

  configNames.forEach((configName) => {
    const variableName = ensureConfigSuffix(configName);
    const position = getVariableStatementEnd(sourceFile, variableName, 'createQueryClient');

    if (!position) {
      return;
    }

    const creatorBlock = generateCreatorsForConfig(configName);

    if (result.includes(creatorBlock.split('\n')[0]!)) {
      return;
    }

    insertions.push({
      position,
      text: `\n\n${creatorBlock}`,
    });
  });

  insertions.sort((left, right) => right.position - left.position);

  insertions.forEach(({ position, text }) => {
    result = result.slice(0, position) + text + result.slice(position);
  });

  return result;
};

const generateCreatorsForConfig = (configName: string) => {
  const creatorBaseName = configName.replace('Client', '');
  const configVariableName = ensureConfigSuffix(configName);

  return [
    `export const ${creatorBaseName}Get = createGetQuery(${configVariableName});`,
    `export const ${creatorBaseName}Post = createPostQuery(${configVariableName});`,
    `export const ${creatorBaseName}Put = createPutQuery(${configVariableName});`,
    `export const ${creatorBaseName}Patch = createPatchQuery(${configVariableName});`,
    `export const ${creatorBaseName}Delete = createDeleteQuery(${configVariableName});`,
  ].join('\n');
};

const declaresName = (declarations: readonly ts.NamedDeclaration[], name: string) =>
  declarations.some(
    (declaration) => declaration.name && ts.isIdentifier(declaration.name) && declaration.name.text === name,
  );

const isShadowedByLocalDeclaration = (identifier: ts.Identifier) => {
  for (let scope: ts.Node | undefined = identifier.parent; scope && !ts.isSourceFile(scope); scope = scope.parent) {
    if (ts.isFunctionLike(scope) && declaresName(scope.parameters, identifier.text)) {
      return true;
    }

    if (
      ts.isBlock(scope) &&
      scope.statements.some(
        (statement) =>
          ts.isVariableStatement(statement) && declaresName(statement.declarationList.declarations, identifier.text),
      )
    ) {
      return true;
    }
  }

  return false;
};

const updateImportsInFile = (content: string, renames: Map<string, string>) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const nextElements: string[] = [];
      let hasChanges = false;

      node.importClause.namedBindings.elements.forEach((element) => {
        const nextName = renames.get(element.propertyName?.text ?? element.name.text);

        if (!nextName) {
          nextElements.push(element.getText(sourceFile));

          return;
        }

        hasChanges = true;
        nextElements.push(element.propertyName ? `${nextName} as ${element.name.text}` : nextName);
      });

      if (hasChanges) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: `import { ${nextElements.join(', ')} } from '${(node.moduleSpecifier as ts.StringLiteral).text}';`,
        });
      }
    }

    if (ts.isIdentifier(node)) {
      const nextName = renames.get(node.text);

      if (!nextName) {
        ts.forEachChild(node, visit);
        return;
      }

      const parent = node.parent;

      if (ts.isImportSpecifier(parent)) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isVariableDeclaration(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isFunctionDeclaration(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isMethodDeclaration(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isParameter(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isPropertyDeclaration(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if ((ts.isPropertyAssignment(parent) && parent.name === node) || isShadowedByLocalDeclaration(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: nextName,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let result = content;

  const seen = new Set<string>();
  const uniqueReplacements = replacements.filter((replacement) => {
    const key = `${replacement.start}:${replacement.end}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });

  uniqueReplacements.sort((left, right) => right.start - left.start);

  uniqueReplacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return result;
};
