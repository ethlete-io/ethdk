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

    // Generate query creators for the configs
    generateQueryCreators(tree, queryClientFiles);

    // Rename all legacy query creators
    renameLegacyQueryCreators(tree, queryClientFiles);

    // Find and update dependent apps
    updateDependentApps(tree, queryClientFiles);
  }

  // Update imports in all files
  if (variableRenames.size > 0) {
    updateImportsAcrossWorkspace(tree, variableRenames);
  }

  // Remove devtools usage
  removeDevtoolsUsage(tree);

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
    const oldBseUrlAsCast = 'as `https://${string}`';
    const cleanedBaseRouteValue = baseRouteValue.replace(oldBseUrlAsCast, '').trim();

    newConfig.push(`baseUrl: ${cleanedBaseRouteValue}`);
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

function updateDependentApps(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const projects = getProjects(tree);

  const updatedApps: string[] = [];
  const warnedApps: string[] = [];

  // Find all apps
  for (const [projectName, projectConfig] of projects.entries()) {
    if (projectConfig.projectType !== 'application') continue;

    const configPaths = [`${projectConfig.root}/src/app/app.config.ts`, `${projectConfig.root}/src/main.ts`];

    let foundImport = false;

    for (const configPath of configPaths) {
      if (!tree.exists(configPath)) continue;

      const content = tree.read(configPath, 'utf-8');
      if (!content) continue;

      // Check if this app imports any of the migrated client configs
      const importedConfigs = findImportedClientConfigs(content, queryClientFiles);

      if (importedConfigs.length > 0) {
        const newContent = addQueryClientProviders(content, importedConfigs);
        if (newContent !== content) {
          tree.write(configPath, newContent);
        }

        updatedApps.push(projectName);

        foundImport = true;

        break;
      }
    }

    if (!foundImport) {
      warnedApps.push(projectName);
    }
  }

  if (updatedApps.length > 0) {
    console.log('\n✅ Updated applications with query client providers:');
    updatedApps.forEach((app) => console.log(` - ${app}`));
  }

  if (warnedApps.length > 0) {
    console.warn('\n⚠️ The following applications may need manual updates for query client providers:');
    warnedApps.forEach((app) => console.warn(` - ${app}`));
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

//#region Generate query creator templates for the new query client configs

function generateQueryCreators(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const generatedFiles: string[] = [];

  for (const [filePath, configNames] of queryClientFiles.entries()) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    // Generate creators for each config in this file
    const newContent = addQueryCreatorsToFile(content, configNames);

    if (newContent !== content) {
      tree.write(filePath, newContent);
      generatedFiles.push(filePath);
    }
  }

  if (generatedFiles.length > 0) {
    console.log('\n✅ Generated query creators in:');
    generatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function addQueryCreatorsToFile(content: string, configNames: string[]): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Find where each config is declared
  const configPositions = new Map<string, number>();

  function visit(node: ts.Node) {
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
        const configName = node.name.text;

        // Find the variable statement (const/let/var line)
        let parent = node.parent;
        while (parent && !ts.isVariableStatement(parent)) {
          parent = parent.parent as any;
        }

        if (parent) {
          configPositions.set(configName, (parent as any).getEnd());
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Generate creators for each config and insert after the config declaration
  let result = content;
  const insertions: Array<{ position: number; text: string }> = [];

  for (const configName of configNames) {
    const position = configPositions.get(`${configName}Config`);
    if (!position) continue;

    const creators = generateCreatorsForConfig(configName);
    insertions.push({ position, text: `\n\n${creators}` });
  }

  // Apply insertions in reverse order to maintain positions
  insertions.sort((a, b) => b.position - a.position);
  for (const { position, text } of insertions) {
    result = result.slice(0, position) + text + result.slice(position);
  }

  return result;
}

function generateCreatorsForConfig(configName: string): string {
  const configNameWithoutClientSuffix = configName.replace('Client', '');

  const creators = [
    `export const ${configNameWithoutClientSuffix}Get = E.createGetQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Post = E.createPostQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Put = E.createPutQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Patch = E.createPatchQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Delete = E.createDeleteQuery(${configName}Config);`,
  ];

  return creators.join('\n');
}

//#endregion

//#region Generate an auth provider if needed (non functional)
// TODO
//#endregion

//#region Rename all query creators to start with "legacy"

function renameLegacyQueryCreators(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const legacyCreators = new Map<string, string>(); // old name -> legacy name
  const renamedFiles: string[] = [];

  // Step 1: Find all legacy query creator declarations
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const creators = findLegacyQueryCreators(content, queryClientFiles);
    if (creators.size > 0) {
      creators.forEach((legacyName, oldName) => {
        legacyCreators.set(oldName, legacyName);
      });

      const newContent = renameLegacyQueryCreatorsInFile(content, creators);
      if (newContent !== content) {
        tree.write(filePath, newContent);
        renamedFiles.push(filePath);
      }
    }
  });

  if (legacyCreators.size > 0) {
    console.log('\n✅ Renamed legacy query creators in:');
    renamedFiles.forEach((file) => console.log(`   - ${file}`));

    // Step 2: Update all imports and usages across the workspace
    updateLegacyCreatorUsages(tree, legacyCreators);
  }
}

function findLegacyQueryCreators(content: string, queryClientFiles: Map<string, string[]>): Map<string, string> {
  const creators = new Map<string, string>(); // old name -> legacy name
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Get all old client names (before adding Config suffix)
  const oldClientNames = new Set<string>();
  queryClientFiles.forEach((configNames) => {
    configNames.forEach((name) => {
      oldClientNames.add(name);
    });
  });

  function visit(node: ts.Node) {
    // Find: export const getRecentCampaigns = futVotingApiClient.get({ ... })
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;

      // Check if it's a method call on one of the old client names
      if (ts.isPropertyAccessExpression(callExpr.expression)) {
        const objExpr = callExpr.expression.expression;
        const methodName = callExpr.expression.name;

        if (
          ts.isIdentifier(objExpr) &&
          ts.isIdentifier(methodName) &&
          oldClientNames.has(objExpr.text) &&
          ['get', 'post', 'put', 'patch', 'delete'].includes(methodName.text)
        ) {
          const oldName = node.name.text;
          const legacyName = toLegacyName(oldName);
          creators.set(oldName, legacyName);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return creators;
}

function toLegacyName(name: string): string {
  // Capitalize first letter after 'legacy'
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return `legacy${capitalized}`;
}

function renameLegacyQueryCreatorsInFile(content: string, creators: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Rename variable declarations
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && creators.has(node.name.text)) {
      const oldName = node.name.text;
      const newName = creators.get(oldName)!;
      replacements.push({
        start: node.name.getStart(sourceFile),
        end: node.name.getEnd(),
        replacement: newName,
      });
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

function updateLegacyCreatorUsages(tree: Tree, legacyCreators: Map<string, string>): void {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    let newContent = content;
    let modified = false;

    // Update imports
    const importUpdated = updateLegacyCreatorImports(newContent, legacyCreators);
    if (importUpdated !== newContent) {
      newContent = importUpdated;
      modified = true;
    }

    // Update object property usages
    const usageUpdated = updateLegacyCreatorObjectUsages(newContent, legacyCreators);
    if (usageUpdated !== newContent) {
      newContent = usageUpdated;
      modified = true;
    }

    if (modified) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n✅ Updated legacy query creator usages in:');
    updatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function updateLegacyCreatorImports(content: string, legacyCreators: Map<string, string>): string {
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
        const importedName = element.propertyName ? element.propertyName.text : element.name.text;
        const newName = legacyCreators.get(importedName);

        if (newName) {
          hasChanges = true;
          // If there's an alias, update the imported name but keep the alias
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

function updateLegacyCreatorObjectUsages(content: string, legacyCreators: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Handle object literal properties
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((prop) => {
        if (ts.isPropertyAssignment(prop)) {
          // Case: { get: getRecentCampaigns } -> { get: legacyGetRecentCampaigns }
          if (ts.isIdentifier(prop.initializer) && legacyCreators.has(prop.initializer.text)) {
            const oldName = prop.initializer.text;
            const newName = legacyCreators.get(oldName)!;
            replacements.push({
              start: prop.initializer.getStart(sourceFile),
              end: prop.initializer.getEnd(),
              replacement: newName,
            });
          }
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          // Case: { getRecentCampaigns } -> { getRecentCampaigns: legacyGetRecentCampaigns }
          if (ts.isIdentifier(prop.name) && legacyCreators.has(prop.name.text)) {
            const oldName = prop.name.text;
            const newName = legacyCreators.get(oldName)!;
            const replacement = `${oldName}: ${newName}`;
            replacements.push({
              start: prop.getStart(sourceFile),
              end: prop.getEnd(),
              replacement,
            });
          }
        }
      });
    }

    // Handle regular identifier references (not in property assignments)
    if (ts.isIdentifier(node)) {
      const nodeText = node.text;

      // Only replace if this identifier is in the legacyCreators map as a KEY (old name)
      // NOT if it's already a legacy name (which would be a VALUE in the map)
      if (legacyCreators.has(nodeText)) {
        const parent = node.parent;

        // Skip if it's a property name in an object literal
        if (ts.isPropertyAssignment(parent) && parent.name === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if it's the initializer in a property assignment (handled above)
        if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if it's a shorthand property
        if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if it's a variable declaration name
        if (ts.isVariableDeclaration(parent) && parent.name === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if it's an import specifier
        if (ts.isImportSpecifier(parent)) {
          ts.forEachChild(node, visit);
          return;
        }

        const newName = legacyCreators.get(nodeText)!;
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: newName,
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

//#region Create new query creators based on the legacy ones
// TODO
//#endregion

//#region Update legacy query creators to use E.createLegacyQueryCreator
// TODO
//#endregion

//#region Check all files for usage of legacy query creators and add injector if needed
// TODO
//#endregion

//#region Remove provideQueryClientForDevtools and QueryDevtoolsComponent in ts / et-query-devtools in html usage

function removeDevtoolsUsage(tree: Tree): void {
  const projects = getProjects(tree);
  const removedFromFiles: string[] = [];

  // Only check app config files for provideQueryClientForDevtools
  for (const [, projectConfig] of projects.entries()) {
    if (projectConfig.projectType !== 'application') continue;

    const configPaths = [`${projectConfig.root}/src/app/app.config.ts`, `${projectConfig.root}/src/main.ts`];

    for (const configPath of configPaths) {
      if (!tree.exists(configPath)) continue;

      const content = tree.read(configPath, 'utf-8');
      if (!content) continue;

      const newContent = removeProvideQueryClientForDevtools(content);
      if (newContent !== content) {
        tree.write(configPath, newContent);
        removedFromFiles.push(configPath);
      }
    }
  }

  // Check all TypeScript files for QueryDevtoolsComponent imports
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Only process if it mentions QueryDevtoolsComponent
    if (!content.includes('QueryDevtoolsComponent')) return;

    const newContent = removeQueryDevtoolsComponent(content);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      if (!removedFromFiles.includes(filePath)) {
        removedFromFiles.push(filePath);
      }
    }
  });

  // Check all HTML files for et-query-devtools
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.html')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Only process if it mentions et-query-devtools
    if (!content.includes('et-query-devtools')) return;

    const newContent = removeDevtoolsFromHtml(content);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      removedFromFiles.push(filePath);
    }
  });

  if (removedFromFiles.length > 0) {
    console.log('\n✅ Removed devtools usage from:');
    removedFromFiles.forEach((file) => console.log(`   - ${file}`));

    console.warn(
      '\n⚠️ Make sure to check the app.config.ts/main.ts files for now unneeded logic inside the providers array (like ...(isDevMode() ? [] : []))',
    );
    console.warn(
      '\n⚠️ Make sure to check the the component in which the devtools component was placed for no longer needed logic (like an empty @if block)',
    );
  }
}

function removeProvideQueryClientForDevtools(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Remove provideQueryClientForDevtools from provider arrays
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'provideQueryClientForDevtools') {
        // Find the array this call is in
        let parent = node.parent;

        // Walk up until we find an array literal expression
        while (parent) {
          if (ts.isArrayLiteralExpression(parent)) {
            // Find which element contains our call expression
            const elementIndex = parent.elements.findIndex((el) => {
              // Check if this element or any of its descendants is our node
              let found = false;
              function search(n: ts.Node): void {
                if (n === node) {
                  found = true;
                  return;
                }
                ts.forEachChild(n, search);
              }
              search(el);
              return found;
            });

            if (elementIndex !== -1) {
              const element = parent.elements[elementIndex]!;
              let start = element.getStart(sourceFile);
              let end = element.getEnd();

              // Handle comma and whitespace removal
              if (elementIndex < parent.elements.length - 1) {
                // Not the last element - remove trailing comma and whitespace
                const nextElement = parent.elements[elementIndex + 1]!;
                const textBetween = content.slice(end, nextElement.getStart(sourceFile));
                const commaIndex = textBetween.indexOf(',');
                if (commaIndex !== -1) {
                  end += commaIndex + 1;
                  // Also remove whitespace after comma
                  while (end < content.length && /\s/.test(content[end]!)) {
                    end++;
                  }
                }
              } else if (elementIndex > 0) {
                // Last element - remove leading comma and whitespace
                const prevElement = parent.elements[elementIndex - 1]!;
                const textBetween = content.slice(prevElement.getEnd(), start);
                const commaIndex = textBetween.lastIndexOf(',');
                if (commaIndex !== -1) {
                  start = prevElement.getEnd() + commaIndex;
                }
              }

              // Remove leading whitespace/newlines
              while (start > 0 && /\s/.test(content[start - 1]!)) {
                start--;
              }

              replacements.push({ start, end, replacement: '' });
            }
            break;
          }
          parent = parent.parent;
        }
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

  // Remove the import if it exists
  return removeDevtoolsImports(result);
}

function removeQueryDevtoolsComponent(content: string): string {
  let result = content;

  // Remove from imports array in components
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Remove QueryDevtoolsComponent from imports arrays in components
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'imports' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      const arrayExpr = node.initializer;
      arrayExpr.elements.forEach((element, index) => {
        if (ts.isIdentifier(element) && element.text === 'QueryDevtoolsComponent') {
          let start = element.getStart(sourceFile);
          let end = element.getEnd();

          // Handle comma removal
          if (index < arrayExpr.elements.length - 1) {
            const nextElement = arrayExpr.elements[index + 1]!;
            const textBetween = content.slice(end, nextElement.getStart(sourceFile));
            const commaIndex = textBetween.indexOf(',');
            if (commaIndex !== -1) {
              end += commaIndex + 1;
              // Also remove whitespace after comma
              while (end < content.length && /\s/.test(content[end]!)) {
                end++;
              }
            }
          } else if (index > 0) {
            const prevElement = arrayExpr.elements[index - 1]!;
            const textBetween = content.slice(prevElement.getEnd(), start);
            const commaIndex = textBetween.lastIndexOf(',');
            if (commaIndex !== -1) {
              start = prevElement.getEnd() + commaIndex;
            }
          }

          // Remove surrounding whitespace
          while (start > 0 && /\s/.test(content[start - 1]!)) {
            start--;
          }

          replacements.push({ start, end, replacement: '' });
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply replacements in reverse order
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  // Remove the import if it exists
  return removeDevtoolsImports(result);
}

function removeDevtoolsImports(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  let queryImportNode: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query' &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      queryImportNode = node;
    }
  });

  if (!queryImportNode?.importClause?.namedBindings || !ts.isNamedImports(queryImportNode.importClause.namedBindings)) {
    return content;
  }

  const namedBindings = queryImportNode.importClause.namedBindings;
  const elementsToKeep = namedBindings.elements.filter(
    (el) => el.name.text !== 'QueryDevtoolsComponent' && el.name.text !== 'provideQueryClientForDevtools',
  );

  if (elementsToKeep.length === namedBindings.elements.length) {
    // Nothing to remove
    return content;
  }

  const importStart = queryImportNode.getStart(sourceFile);
  const importEnd = queryImportNode.getEnd();

  if (elementsToKeep.length === 0) {
    // Remove entire import statement
    let start = importStart;
    let end = importEnd;
    // Also remove the newline after the import
    if (content[end] === '\n') end++;
    return content.slice(0, start) + content.slice(end);
  }

  // Reconstruct import without devtools
  const newImports = elementsToKeep.map((el) => el.getText(sourceFile));
  const moduleSpecifier = (queryImportNode.moduleSpecifier as ts.StringLiteral).text;
  const newImportStatement = `import { ${newImports.join(', ')} } from '${moduleSpecifier}';`;

  return content.slice(0, importStart) + newImportStatement + content.slice(importEnd);
}

function removeDevtoolsFromHtml(content: string): string {
  let result = content;

  // Remove self-closing tags
  result = result.replace(/<et-query-devtools\s*\/>/g, '');

  // Remove opening and closing tags with content
  result = result.replace(/<et-query-devtools[^>]*>[\s\S]*?<\/et-query-devtools>/g, '');

  return result;
}

//#endregion
