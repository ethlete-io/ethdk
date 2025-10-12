import { Tree, formatFiles, getProjects, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

//#region Migration main

interface MigrationSchema {
  skipFormat?: boolean;
}

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  const queryClientFiles = new Map<string, string[]>(); // filepath -> config names
  const variableRenames = new Map<string, string>(); // old name -> new name

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    let modified = false;
    let newContent = content;

    if (needsExperimentalQueryImport(content)) {
      newContent = addExperimentalQueryImport(newContent);
      modified = true;
    }

    if (hasQueryClientInstantiation(content)) {
      const renames = new Map<string, string>();
      newContent = migrateQueryClientToConfig(newContent, renames);
      modified = true;

      // Store the renames for updating imports in other files
      renames.forEach((newName, oldName) => {
        variableRenames.set(oldName, newName);
      });

      const configNames = extractClientConfigNames(newContent);
      if (configNames.length > 0) {
        queryClientFiles.set(filePath, configNames);
      }
    }

    if (modified) {
      tree.write(filePath, newContent);
    }
  });

  if (queryClientFiles.size > 0) {
    console.log('\n✅ Migrated QueryClient instantiations in:');
    queryClientFiles.forEach((configs, file) => {
      console.log(`   - ${file} (${configs.join(', ')})`);
    });

    // Find and update dependent apps
    updateDependentApps(tree, queryClientFiles);
  }

  // Update imports in all files
  if (variableRenames.size > 0) {
    updateImportsAcrossWorkspace(tree, variableRenames);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

//#endregion

//#region import ExperimentalQuery as E

function needsExperimentalQueryImport(content: string): boolean {
  // Check if file imports from @ethlete/query
  const hasQueryImport = /from\s+['"]@ethlete\/query['"]/.test(content);
  // Check if already has ExperimentalQuery import
  const hasExperimentalQueryImport = /import\s*{[^}]*ExperimentalQuery/.test(content);

  return hasQueryImport && !hasExperimentalQueryImport;
}

function addExperimentalQueryImport(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

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

  if (!queryImportNode || !queryImportNode.importClause?.namedBindings) {
    return content;
  }

  const namedBindings = queryImportNode.importClause.namedBindings;

  if (!ts.isNamedImports(namedBindings)) {
    return content;
  }

  const importStart = queryImportNode.getStart(sourceFile);
  const importEnd = queryImportNode.getEnd();

  const existingImports = namedBindings.elements.map((el) => el.getText(sourceFile));
  const newImports = [...existingImports, 'ExperimentalQuery as E'];
  const newImportStatement = `import { ${newImports.join(', ')} } from '@ethlete/query';`;

  return content.slice(0, importStart) + newImportStatement + content.slice(importEnd);
}

//#endregion

//#region Query client to config

function hasQueryClientInstantiation(content: string): boolean {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  let hasQueryClientImport = false;
  let hasNewQueryClient = false;

  ts.forEachChild(sourceFile, function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query' &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const hasQueryClient = node.importClause.namedBindings.elements.some((el) => el.name.text === 'QueryClient');
      if (hasQueryClient) {
        hasQueryClientImport = true;
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'QueryClient') {
      hasNewQueryClient = true;
    }

    ts.forEachChild(node, visit);
  });

  return hasQueryClientImport && hasNewQueryClient;
}

// function migrateQueryClientToConfig(content: string): string {
//   const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

//   let result = content;
//   const replacements: Array<{ start: number; end: number; replacement: string }> = [];
//   const variableRenames = new Map<string, string>(); // old name -> new name

//   function visit(node: ts.Node) {
//     // Find: new QueryClient({ baseRoute: '...' })
//     if (
//       ts.isNewExpression(node) &&
//       ts.isIdentifier(node.expression) &&
//       node.expression.text === 'QueryClient' &&
//       node.arguments &&
//       node.arguments.length > 0
//     ) {
//       const configArg = node.arguments[0]!;

//       if (ts.isObjectLiteralExpression(configArg)) {
//         const oldVariableName = getVariableNameForQueryClient(node, sourceFile);
//         const newVariableName = ensureConfigSuffix(oldVariableName);

//         if (oldVariableName !== newVariableName) {
//           variableRenames.set(oldVariableName, newVariableName);
//         }

//         const migrated = migrateConfigObject(configArg, node, sourceFile);

//         replacements.push({
//           start: node.getStart(sourceFile),
//           end: node.getEnd(),
//           replacement: migrated,
//         });
//       }
//     }

//     ts.forEachChild(node, visit);
//   }

//   visit(sourceFile);

//   // Apply replacements in reverse order to maintain positions
//   replacements.sort((a, b) => b.start - a.start);
//   for (const { start, end, replacement } of replacements) {
//     result = result.slice(0, start) + replacement + result.slice(end);
//   }

//   // Remove QueryClient from imports
//   result = removeQueryClientImport(result);

//   // Rename variables throughout the file
//   result = renameVariables(result, variableRenames);

//   return result;
// }

function migrateQueryClientToConfig(content: string, renamesOut?: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  let result = content;
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const variableRenames = new Map<string, string>(); // old name -> new name

  function visit(node: ts.Node) {
    // Find: new QueryClient({ baseRoute: '...' })
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'QueryClient' &&
      node.arguments &&
      node.arguments.length > 0
    ) {
      const configArg = node.arguments[0]!;

      if (ts.isObjectLiteralExpression(configArg)) {
        const oldVariableName = getVariableNameForQueryClient(node, sourceFile);
        const newVariableName = ensureConfigSuffix(oldVariableName);

        if (oldVariableName !== newVariableName) {
          variableRenames.set(oldVariableName, newVariableName);
          if (renamesOut) {
            renamesOut.set(oldVariableName, newVariableName);
          }
        }

        const migrated = migrateConfigObject(configArg, node, sourceFile);

        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: migrated,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply replacements in reverse order to maintain positions
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  // Remove QueryClient from imports
  result = removeQueryClientImport(result);

  // Rename variables throughout the file
  result = renameVariables(result, variableRenames);

  return result;
}

function ensureConfigSuffix(name: string): string {
  // If already ends with Config, return as is
  if (/Config$/i.test(name)) {
    return name;
  }

  // Just add Config to the end, keeping everything including "Client"
  return `${name}Config`;
}

function removeQueryClientImport(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

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

  if (!queryImportNode?.importClause?.namedBindings || !ts.isNamedImports(queryImportNode.importClause.namedBindings)) {
    return content;
  }

  const namedBindings = queryImportNode.importClause.namedBindings;
  const elements = namedBindings.elements.filter((el) => el.name.text !== 'QueryClient');

  // If no imports left, remove the entire import statement
  if (elements.length === 0) {
    const importStart = queryImportNode.getStart(sourceFile);
    const importEnd = queryImportNode.getEnd();
    // Also remove the newline after the import
    const nextChar = content[importEnd];
    const endPos = nextChar === '\n' ? importEnd + 1 : importEnd;
    return content.slice(0, importStart) + content.slice(endPos);
  }

  // Otherwise, reconstruct import without QueryClient
  const importStart = queryImportNode.getStart(sourceFile);
  const importEnd = queryImportNode.getEnd();
  const newImports = elements.map((el) => el.getText(sourceFile));
  const newImportStatement = `import { ${newImports.join(', ')} } from '@ethlete/query';`;

  return content.slice(0, importStart) + newImportStatement + content.slice(importEnd);
}

function renameVariables(content: string, renames: Map<string, string>): string {
  if (renames.size === 0) return content;

  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Rename variable declarations
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const oldName = node.name.text;
      const newName = renames.get(oldName);
      if (newName) {
        replacements.push({
          start: node.name.getStart(sourceFile),
          end: node.name.getEnd(),
          replacement: newName,
        });
      }
    } else if (ts.isIdentifier(node)) {
      const oldName = node.text;
      const newName = renames.get(oldName);
      if (newName) {
        // Make sure we're not renaming property names in object literals
        const parent = node.parent;
        if (!ts.isPropertyAssignment(parent) || parent.name !== node) {
          replacements.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            replacement: newName,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply replacements in reverse order
  let result = content;

  // remove duplicates from replacements
  const seen = new Set<string>();
  const uniqueReplacements = replacements.filter((r) => {
    const key = `${r.start}-${r.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  uniqueReplacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of uniqueReplacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

function migrateConfigObject(configArg: ts.ObjectLiteralExpression, node: ts.Node, sourceFile: ts.SourceFile): string {
  const variableName = getVariableNameForQueryClient(node, sourceFile);
  const newConfig: string[] = [];

  // Extract baseRoute -> baseUrl
  const baseRouteProp = configArg.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'baseRoute',
  ) as ts.PropertyAssignment | undefined;

  if (baseRouteProp) {
    const baseRouteValue = baseRouteProp.initializer.getText(sourceFile);
    newConfig.push(`baseUrl: ${baseRouteValue}`);
  }

  newConfig.push(`name: '${variableName}'`);

  // Extract request.queryParams -> queryString
  const requestProp = configArg.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'request',
  ) as ts.PropertyAssignment | undefined;

  if (requestProp && ts.isObjectLiteralExpression(requestProp.initializer)) {
    const requestObj = requestProp.initializer;

    const queryParamsProp = requestObj.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'queryParams',
    ) as ts.PropertyAssignment | undefined;

    if (queryParamsProp) {
      const queryParamsValue = queryParamsProp.initializer.getText(sourceFile);
      newConfig.push(`queryString: ${queryParamsValue}`);
    }

    const cacheAdapterProp = requestObj.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'cacheAdapter',
    ) as ts.PropertyAssignment | undefined;

    if (cacheAdapterProp) {
      const cacheAdapterValue = cacheAdapterProp.initializer.getText(sourceFile);
      newConfig.push(`cacheAdapter: ${cacheAdapterValue}`);
    }

    const retryFnProp = requestObj.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'retryFn',
    ) as ts.PropertyAssignment | undefined;

    if (retryFnProp) {
      const retryFnValue = retryFnProp.initializer.getText(sourceFile);
      newConfig.push(`retryFn: ${retryFnValue}`);
    }
  }

  return `E.createQueryClientConfig({\n  ${newConfig.join(',\n  ')}\n})`;
}

function getVariableNameForQueryClient(node: ts.Node, sourceFile: ts.SourceFile): string {
  let parent = node.parent;

  // Walk up to find variable declaration
  while (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    parent = parent.parent;
  }

  return 'client';
}

function extractClientConfigNames(content: string): string[] {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const configNames: string[] = [];

  function visit(node: ts.Node) {
    // Find: const XXX = E.createQueryClientConfig(...)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;
      if (
        ts.isPropertyAccessExpression(callExpr.expression) &&
        ts.isIdentifier(callExpr.expression.expression) &&
        callExpr.expression.expression.text === 'E' &&
        ts.isIdentifier(callExpr.expression.name) &&
        callExpr.expression.name.text === 'createQueryClientConfig'
      ) {
        // This extracts the NEW variable name (apiClientConfig)
        // But we should extract the name from the config object instead!
        const nameArg = callExpr.arguments[0];
        if (nameArg && ts.isObjectLiteralExpression(nameArg)) {
          const nameProp = nameArg.properties.find(
            (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'name',
          ) as ts.PropertyAssignment | undefined;

          if (nameProp && ts.isStringLiteral(nameProp.initializer)) {
            configNames.push(nameProp.initializer.text); // Extract from 'name' property
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return configNames;
}

//#endregion

//#region Add query client providers to apps

// FIXME: This only seems to work for 1 app

function updateDependentApps(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const projects = getProjects(tree);

  // Find all apps
  for (const [projectName, projectConfig] of projects.entries()) {
    if (projectConfig.projectType !== 'application') continue;

    const configPaths = [`${projectConfig.root}/src/app/app.config.ts`, `${projectConfig.root}/src/main.ts`];

    for (const configPath of configPaths) {
      if (!tree.exists(configPath)) continue;

      const content = tree.read(configPath, 'utf-8');
      if (!content) continue;

      // Check if this app imports any of the migrated client configs
      const importedConfigs = findImportedClientConfigs(content, queryClientFiles);

      if (importedConfigs.length > 0) {
        console.log(`\n📦 Updating ${projectName} providers`);
        const newContent = addQueryClientProviders(content, importedConfigs);
        if (newContent !== content) {
          tree.write(configPath, newContent);
        }
        break;
      }
    }
  }
}

function findImportedClientConfigs(content: string, queryClientFiles: Map<string, string[]>): string[] {
  const importedConfigs: string[] = [];

  // Get all config names from migrated files (these are the OLD names like 'apiClient')
  const allConfigNames = new Set<string>();
  queryClientFiles.forEach((configs) => configs.forEach((c) => allConfigNames.add(c)));

  // Check if any of these configs are imported in this file
  for (const configName of allConfigNames) {
    const importRegex = new RegExp(`\\b${configName}\\b`);
    if (importRegex.test(content)) {
      // We need to add the Config suffix because the actual variable name is apiClientConfig
      const configNameWithSuffix = ensureConfigSuffix(configName);
      importedConfigs.push(configNameWithSuffix);
    }
  }

  return importedConfigs;
}

function addQueryClientProviders(content: string, clientConfigs: string[]): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  let providersArrayNode: ts.ArrayLiteralExpression | undefined;

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'providers' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      providersArrayNode = node.initializer;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!providersArrayNode) return content;

  const newProviders = clientConfigs.map((config) => `E.provideQueryClient(${config})`);

  const elements = providersArrayNode.elements;
  if (elements.length > 0) {
    const insertPosition = elements[elements.length - 1]!.getEnd();
    const insertion = `,\n    ${newProviders.join(',\n    ')}`;
    return content.slice(0, insertPosition) + insertion + content.slice(insertPosition);
  } else {
    const insertPosition = providersArrayNode.getStart(sourceFile) + 1;
    const insertion = `\n    ${newProviders.join(',\n    ')}\n  `;
    return content.slice(0, insertPosition) + insertion + content.slice(insertPosition);
  }
}

//#endregion

//#region Update imports across workspace

function updateImportsAcrossWorkspace(tree: Tree, renames: Map<string, string>): void {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const newContent = updateImportsInFile(content, renames);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n📝 Updated imports in:');
    updatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function updateImportsInFile(content: string, renames: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Update named imports
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const namedBindings = node.importClause.namedBindings;
      let hasChanges = false;
      const newElements: string[] = [];

      namedBindings.elements.forEach((element) => {
        const importedName = element.name.text;
        const newName = renames.get(importedName);

        if (newName) {
          hasChanges = true;
          // If there's an alias, keep it: import { old as alias } -> import { new as alias }
          if (element.propertyName) {
            newElements.push(`${newName} as ${element.name.text}`);
          } else {
            newElements.push(newName);
          }
        } else {
          newElements.push(element.getText(sourceFile));
        }
      });

      if (hasChanges) {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
        const newImportStatement = `import { ${newElements.join(', ')} } from '${moduleSpecifier}';`;
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: newImportStatement,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply replacements in reverse order
  let result = content;
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

//#endregion

//#region Generate an auth provider if needed (non functional)
// TODO
//#endregion

//#region Generate query creator templates for the new query client configs
// TODO
//#endregion

//#region Rename all query creators to start with "legacy"
// TODO
//#endregion

//#region Create new query creators based on the legacy ones
// TODO
//#endregion

//#region Update legacy query creators to use E.createLegacyQueryCreator
// TODO
//#endregion

//#region Check all files for usage of legacy query creators and add injector if needed
// TODO
//#endregion
