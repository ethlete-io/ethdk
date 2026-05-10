import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { QueryV3MigrationReport } from './report.js';
import {
  capitalizeFirstLetter,
  createSourceFile,
  ensureConfigSuffix,
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

export const migrateQueryClients = (tree: Tree, report: QueryV3MigrationReport): QueryClientMigrationResult => {
  const queryClientFiles = new Map<string, string[]>();
  const variableRenames = new Map<string, string>();

  visitNotIgnoredFiles(tree, '', (filePath) => {
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

export const updateImportsAcrossWorkspace = (tree: Tree, renames: Map<string, string>) => {
  if (renames.size === 0) {
    return;
  }

  visitNotIgnoredFiles(tree, '', (filePath) => {
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

  const visit = (node: ts.Node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'V2QueryClient' &&
      node.arguments &&
      node.arguments.length > 0
    ) {
      const configArgument = node.arguments[0]!;

      if (ts.isObjectLiteralExpression(configArgument)) {
        const oldVariableName = getVariableNameForQueryClient(node);
        const newVariableName = ensureConfigSuffix(oldVariableName);

        if (oldVariableName !== newVariableName) {
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

  result = removeQueryClientImport(result);

  return renameVariables(result, variableRenames);
};

const removeQueryClientImport = (content: string) => {
  const sourceFile = createSourceFile(content);
  let queryImportNode: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query'
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
    return element.name.text !== 'V2QueryClient';
  });

  const nextImports = new Set<string>(requiredImports);
  existingElements.forEach((element) => nextImports.add(element.name.text));

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

const migrateConfigObject = (configArgument: ts.ObjectLiteralExpression, node: ts.Node, sourceFile: ts.SourceFile) => {
  const variableName = getVariableNameForQueryClient(node);
  const nextConfig: string[] = [];

  const baseRouteProperty = configArgument.properties.find((property) => {
    return ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'baseRoute';
  });

  if (baseRouteProperty && ts.isPropertyAssignment(baseRouteProperty)) {
    const baseRouteValue = baseRouteProperty.initializer
      .getText(sourceFile)
      .replace('as `https://${string}`', '')
      .trim();

    nextConfig.push(`baseUrl: ${baseRouteValue}`);
  }

  nextConfig.push(`name: '${variableName}'`);

  const requestProperty = configArgument.properties.find((property) => {
    return ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'request';
  });

  if (
    requestProperty &&
    ts.isPropertyAssignment(requestProperty) &&
    ts.isObjectLiteralExpression(requestProperty.initializer)
  ) {
    requestProperty.initializer.properties.forEach((property) => {
      if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
        return;
      }

      if (property.name.text === 'queryParams') {
        nextConfig.push(`queryString: ${property.initializer.getText(sourceFile)}`);
      }

      if (property.name.text === 'cacheAdapter') {
        nextConfig.push(`cacheAdapter: ${property.initializer.getText(sourceFile)}`);
      }

      if (property.name.text === 'retryFn') {
        nextConfig.push(`retryFn: ${property.initializer.getText(sourceFile)}`);
      }
    });
  }

  return `createQueryClient({\n  ${nextConfig.join(',\n  ')}\n})`;
};

const getVariableNameForQueryClient = (node: ts.Node): string => {
  let parent = node.parent;

  while (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    parent = parent.parent;
  }

  return 'client';
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

    if (result.includes(`export const [${provideName}, ${injectName}] = ${variableName};`)) {
      return;
    }

    insertions.push({
      position,
      text: `\n\nexport const [${provideName}, ${injectName}] = ${variableName};`,
    });
  });

  insertions.sort((left, right) => right.position - left.position);

  insertions.forEach(({ position, text }) => {
    result = result.slice(0, position) + text + result.slice(position);
  });

  return result;
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
        const nextName = renames.get(element.name.text);

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

      if (ts.isPropertyAssignment(parent) && parent.name === node) {
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
