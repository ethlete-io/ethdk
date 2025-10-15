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

    // Generate inject functions for the configs
    generateInjectFunctions(tree, queryClientFiles);

    // Create new query creators based on legacy ones (this also creates legacy wrappers)
    createNewQueryCreators(tree, queryClientFiles);

    // Update imports to include legacy wrappers where needed
    updateLegacyCreatorImportsAndUsages(tree, queryClientFiles);

    // Find and update dependent apps
    updateDependentApps(tree, queryClientFiles);
  }

  // Update imports in all files
  if (variableRenames.size > 0) {
    updateImportsAcrossWorkspace(tree, variableRenames);
  }

  // Replace AnyQuery with E.AnyLegacyQuery everywhere
  replaceAnyQueryWithLegacy(tree);

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

//#region Create new query creators based on the legacy ones

interface LegacyQueryCreatorInfo {
  name: string;
  clientName: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  route: string;
  typeArgs?: string;
  typeResponse?: string;
  typeBody?: string;
  secure: boolean;
  httpOptions: Map<string, string>;
  position: { start: number; end: number };
}

function toLegacyName(name: string): string {
  // Capitalize first letter after 'legacy'
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return `legacy${capitalized}`;
}

function createNewQueryCreators(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const createdFiles: string[] = [];
  const authProvidersNeeded = new Map<string, string>(); // clientName -> client file path

  // Build a map of client names to their file paths
  const clientNameToFilePath = new Map<string, string>();
  queryClientFiles.forEach((configNames, filePath) => {
    configNames.forEach((name) => {
      clientNameToFilePath.set(name, filePath);
    });
  });

  // Step 1: Find all legacy query creators and analyze them
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const legacyCreators = analyzeLegacyQueryCreators(content, queryClientFiles);
    if (legacyCreators.length === 0) return;

    // Check if any creators need auth and map to their client file
    legacyCreators.forEach((creator) => {
      if (creator.secure) {
        const clientFilePath = clientNameToFilePath.get(creator.clientName);
        if (clientFilePath) {
          authProvidersNeeded.set(creator.clientName, clientFilePath);
        }
      }
    });

    const newContent = transformLegacyQueryCreators(content, legacyCreators, queryClientFiles);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      createdFiles.push(filePath);
    }
  });

  // Step 2: Create auth providers where needed
  if (authProvidersNeeded.size > 0) {
    createAuthProviders(tree, authProvidersNeeded, queryClientFiles);
  }

  if (createdFiles.length > 0) {
    console.log('\n✅ Created new query creators in:');
    createdFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function analyzeLegacyQueryCreators(
  content: string,
  queryClientFiles: Map<string, string[]>,
): LegacyQueryCreatorInfo[] {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const creators: LegacyQueryCreatorInfo[] = [];

  // Get all old client names
  const oldClientNames = new Set<string>();
  queryClientFiles.forEach((configNames) => {
    configNames.forEach((name) => oldClientNames.add(name));
  });

  function visit(node: ts.Node) {
    // Find: const getUsers = apiClient.get({ ... })
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;

      if (ts.isPropertyAccessExpression(callExpr.expression)) {
        const objExpr = callExpr.expression.expression;
        const methodName = callExpr.expression.name;

        if (
          ts.isIdentifier(objExpr) &&
          ts.isIdentifier(methodName) &&
          oldClientNames.has(objExpr.text) &&
          ['get', 'post', 'put', 'patch', 'delete'].includes(methodName.text)
        ) {
          const info: LegacyQueryCreatorInfo = {
            name: node.name.text,
            clientName: objExpr.text,
            method: methodName.text as any,
            route: '',
            secure: false,
            httpOptions: new Map(),
            position: {
              start: node.getStart(sourceFile),
              end: node.getEnd(),
            },
          };

          // Parse the config object
          if (callExpr.arguments.length > 0 && ts.isObjectLiteralExpression(callExpr.arguments[0]!)) {
            const configObj = callExpr.arguments[0];

            configObj.properties.forEach((prop) => {
              if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) return;

              const propName = prop.name.text;

              // Extract route
              if (propName === 'route') {
                info.route = prop.initializer.getText(sourceFile);
              }

              // Extract secure flag
              if (propName === 'secure' && prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                info.secure = true;
              }

              // Extract types
              if (propName === 'types' && ts.isObjectLiteralExpression(prop.initializer)) {
                prop.initializer.properties.forEach((typeProp) => {
                  if (!ts.isPropertyAssignment(typeProp) || !ts.isIdentifier(typeProp.name)) return;

                  const typeName = typeProp.name.text;
                  const typeValue = extractTypeFromDef(typeProp.initializer, sourceFile);

                  if (typeName === 'args') info.typeArgs = typeValue;
                  if (typeName === 'response') info.typeResponse = typeValue;
                  if (typeName === 'body') info.typeBody = typeValue;
                });
              }

              // Extract HTTP options
              if (['reportProgress', 'responseType', 'transferCache', 'withCredentials'].includes(propName)) {
                info.httpOptions.set(propName, prop.initializer.getText(sourceFile));
              }
            });
          }

          if (info.route) {
            creators.push(info);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return creators;
}

function extractTypeFromDef(node: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
  // Extract type from def<Type>() call
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'def') {
    if (node.typeArguments && node.typeArguments.length > 0) {
      return node.typeArguments[0]!.getText(sourceFile);
    }
  }
  return undefined;
}

function transformLegacyQueryCreators(
  content: string,
  legacyCreators: LegacyQueryCreatorInfo[],
  queryClientFiles: Map<string, string[]>,
): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Group creators by client
  const creatorsByClient = new Map<string, LegacyQueryCreatorInfo[]>();
  legacyCreators.forEach((creator) => {
    if (!creatorsByClient.has(creator.clientName)) {
      creatorsByClient.set(creator.clientName, []);
    }
    creatorsByClient.get(creator.clientName)!.push(creator);
  });

  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  // Transform each legacy creator
  legacyCreators.forEach((creator) => {
    const newCreatorCode = generateNewQueryCreator(creator, sourceFile);
    const legacyWrapperCode = generateLegacyWrapper(creator);

    const fullReplacement = `${newCreatorCode}\n${legacyWrapperCode}`;

    // Find the variable statement (which includes 'export const')
    let variableStatement: ts.VariableStatement | undefined;

    function findVariableStatement(node: ts.Node) {
      if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];
        if (declaration && ts.isIdentifier(declaration.name) && declaration.name.text === creator.name) {
          variableStatement = node;
        }
      }
      ts.forEachChild(node, findVariableStatement);
    }

    findVariableStatement(sourceFile);

    if (variableStatement) {
      replacements.push({
        start: variableStatement.getStart(sourceFile),
        end: variableStatement.getEnd(),
        replacement: fullReplacement,
      });
    }
  });

  // Apply replacements in reverse order
  let result = content;
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  // Update imports to include necessary creator functions
  result = addCreatorImports(result, creatorsByClient);

  return result;
}

function addCreatorImports(content: string, creatorsByClient: Map<string, LegacyQueryCreatorInfo[]>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  // Build a map of import source -> set of all imports needed from that source
  const importsBySource = new Map<string, Set<string>>();

  creatorsByClient.forEach((creators, clientName) => {
    const clientNameWithoutClient = clientName.replace(/Client$/, '');
    const configName = `${clientName}Config`;

    // Collect unique methods
    const methodsUsed = new Set<string>();
    let hasSecure = false;

    creators.forEach((creator) => {
      methodsUsed.add(creator.method);
      if (creator.secure) {
        hasSecure = true;
      }
    });

    // Build the list of imports needed for this client
    const importsNeeded = new Set<string>();
    importsNeeded.add(configName);

    methodsUsed.forEach((method) => {
      const methodCapitalized = method.charAt(0).toUpperCase() + method.slice(1);

      // Add non-secure creator
      importsNeeded.add(`${clientNameWithoutClient}${methodCapitalized}`);

      // Add secure creator if needed
      if (hasSecure) {
        importsNeeded.add(`${clientNameWithoutClient}${methodCapitalized}Secure`);
      }
    });

    // Store these imports for later (we'll determine the source file when we find the import)
    // For now, associate with the client name
    importsBySource.set(clientName, importsNeeded);
  });

  // Update import statements
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleSpecifier = node.moduleSpecifier.text;

      // Get existing imports from this statement
      const existingImports = new Set<string>();
      const clientsInThisImport: string[] = [];

      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((el) => {
          const importName = el.name.text;
          existingImports.add(importName);

          // Check if this is one of our client names
          if (importsBySource.has(importName)) {
            clientsInThisImport.push(importName);
          }
        });
      }

      if (clientsInThisImport.length === 0) {
        // This import doesn't contain any of our clients
        ts.forEachChild(node, visit);
        return;
      }

      // Accumulate all imports needed from all clients in this import statement
      const allImportsNeeded = new Set<string>();

      clientsInThisImport.forEach((clientName) => {
        const importsForClient = importsBySource.get(clientName);
        if (importsForClient) {
          importsForClient.forEach((imp) => allImportsNeeded.add(imp));
        }
      });

      // Remove the old client names from the final import list
      clientsInThisImport.forEach((clientName) => {
        allImportsNeeded.delete(clientName);
      });

      // Keep other existing imports that aren't client names
      existingImports.forEach((imp) => {
        if (!clientsInThisImport.includes(imp)) {
          allImportsNeeded.add(imp);
        }
      });

      // Create new import statement with all accumulated imports
      const importsList = Array.from(allImportsNeeded).sort().join(', ');
      const newImportStatement = `import { ${importsList} } from '${moduleSpecifier}';`;

      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: newImportStatement,
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

function generateNewQueryCreator(creator: LegacyQueryCreatorInfo, sourceFile: ts.SourceFile): string {
  const clientNameWithoutClient = creator.clientName.replace(/Client$/, '');
  const methodCapitalized = creator.method.charAt(0).toUpperCase() + creator.method.slice(1);

  // Build type parameter
  let typeParam = '';

  if (creator.typeArgs && (creator.typeBody || creator.typeResponse)) {
    // Case 1: Has args + other types -> use intersection
    // Example: GetCollectionsArgs & { response: Paginated<BaseCollectionView> }
    const additionalTypes: string[] = [];
    if (creator.typeBody) {
      additionalTypes.push(`body: ${creator.typeBody}`);
    }
    if (creator.typeResponse) {
      additionalTypes.push(`response: ${creator.typeResponse}`);
    }
    typeParam = `<${creator.typeArgs} & { ${additionalTypes.join('; ')} }>`;
  } else if (creator.typeArgs) {
    // Case 2: Only args -> use directly
    // Example: PostCollectionAcceptAllWithoutStatusArgs
    typeParam = `<${creator.typeArgs}>`;
  } else if (creator.typeBody || creator.typeResponse) {
    // Case 3: No args, but has body/response -> wrap in object
    // Example: { body: CreateUserDto; response: User }
    const typeProps: string[] = [];
    if (creator.typeBody) {
      typeProps.push(`body: ${creator.typeBody}`);
    }
    if (creator.typeResponse) {
      typeProps.push(`response: ${creator.typeResponse}`);
    }
    typeParam = `<{ ${typeProps.join('; ')} }>`;
  }
  // Case 4: No types at all -> no type parameter

  // Build options object
  const options: string[] = [];
  creator.httpOptions.forEach((value, key) => {
    options.push(`${key}: ${value}`);
  });

  const optionsStr = options.length > 0 ? `, {\n  ${options.join(',\n  ')}\n}` : '';

  // Choose the right creator function
  const creatorFn = creator.secure
    ? `${clientNameWithoutClient}${methodCapitalized}Secure`
    : `${clientNameWithoutClient}${methodCapitalized}`;

  // Now we include 'export const' since we're replacing the entire statement
  return `export const ${creator.name} = ${creatorFn}${typeParam}(${creator.route}${optionsStr});`;
}

function generateLegacyWrapper(creator: LegacyQueryCreatorInfo): string {
  const legacyName = toLegacyName(creator.name);
  return `export const ${legacyName} = E.createLegacyQueryCreator({ creator: ${creator.name} });`;
}

function createAuthProviders(
  tree: Tree,
  authProvidersNeeded: Map<string, string>,
  queryClientFiles: Map<string, string[]>,
): void {
  const createdProviders: string[] = [];

  authProvidersNeeded.forEach((filePath, clientName) => {
    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Check if auth provider already exists
    const authProviderName = `${clientName}AuthProviderConfig`;
    if (content.includes(authProviderName)) {
      return; // Already exists
    }

    const configName = `${clientName}Config`;
    let newContent = addAuthProviderToFile(content, clientName, configName);

    if (newContent !== content) {
      // Generate secure query creators
      newContent = generateSecureQueryCreators(newContent, clientName);

      // Generate inject function for auth provider
      newContent = addAuthProviderInjectFunction(newContent, clientName);

      tree.write(filePath, newContent);
      createdProviders.push(filePath);
    }
  });

  if (createdProviders.length > 0) {
    console.log('\n✅ Created auth providers in:');
    createdProviders.forEach((file) => console.log(`   - ${file}`));

    console.warn(
      '\n⚠️ Make sure to provide them in the respective app.config/main.ts providers array using E.provideBearerAuthProvider(yourConfigName)',
    );
  }
}

function addAuthProviderInjectFunction(content: string, clientName: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const authProviderName = `${clientName}AuthProviderConfig`;

  // Find where the auth provider is declared
  let authProviderPosition: number | undefined;

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === authProviderName &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      let parent = node.parent;
      while (parent && !ts.isVariableStatement(parent)) {
        parent = parent.parent as any;
      }

      if (parent) {
        authProviderPosition = (parent as any).getEnd();
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!authProviderPosition) return content;

  // Check if inject function already exists
  const injectFunctionName = `inject${clientName.charAt(0).toUpperCase() + clientName.slice(1)}AuthProvider`;
  if (content.includes(injectFunctionName)) {
    return content;
  }

  // Ensure inject is imported
  let result = content;
  const hasInjectImport =
    result.includes('import { inject }') || (result.includes("from '@angular/core'") && result.includes('inject'));

  if (!hasInjectImport) {
    result = addInjectImport(result);
  }

  // Generate inject function for auth provider
  const injectFunction = `\n\nexport const ${injectFunctionName} = () => inject(${authProviderName}.token);`;

  return result.slice(0, authProviderPosition) + injectFunction + result.slice(authProviderPosition);
}

function addAuthProviderToFile(content: string, clientName: string, configName: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Find where the config is declared
  let configPosition: number | undefined;

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === configName &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      // Find the variable statement
      let parent = node.parent;
      while (parent && !ts.isVariableStatement(parent)) {
        parent = parent.parent as any;
      }

      if (parent) {
        configPosition = (parent as any).getEnd();
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!configPosition) return content;

  const authProviderCode = `

export const ${clientName}AuthProviderConfig = E.createBearerAuthProviderConfig({
  name: '${clientName}',
  queryClientRef: ${configName}.token,
});`;

  return content.slice(0, configPosition) + authProviderCode + content.slice(configPosition);
}

function generateSecureQueryCreators(content: string, clientName: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Find where the auth provider is declared
  let authProviderPosition: number | undefined;
  const authProviderName = `${clientName}AuthProviderConfig`;

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === authProviderName &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      let parent = node.parent;
      while (parent && !ts.isVariableStatement(parent)) {
        parent = parent.parent as any;
      }

      if (parent) {
        authProviderPosition = (parent as any).getEnd();
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!authProviderPosition) return content;

  const clientNameWithoutClient = clientName.replace('Client', '');
  const configName = `${clientName}Config`;

  const secureCreators = [
    `export const ${clientNameWithoutClient}GetSecure = E.createSecureGetQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}PostSecure = E.createSecurePostQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}PutSecure = E.createSecurePutQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}PatchSecure = E.createSecurePatchQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}DeleteSecure = E.createSecureDeleteQuery(${configName}, ${authProviderName});`,
  ].join('\n');

  return content.slice(0, authProviderPosition) + '\n\n' + secureCreators + content.slice(authProviderPosition);
}

//#endregion

//#region Update legacy query creator imports and usages

function updateLegacyCreatorImportsAndUsages(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const legacyCreators = new Map<string, string>(); // original name -> legacy name
  const updatedFiles: string[] = [];

  // Step 1: Find all legacy wrappers that were created
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const wrappers = findLegacyWrappers(content);
    wrappers.forEach((legacyName, originalName) => {
      legacyCreators.set(originalName, legacyName);
    });
  });

  if (legacyCreators.size === 0) return;

  console.log(`\n✅ Found ${legacyCreators.size} legacy query creator wrappers`);

  // Step 2: Update imports and usages across the workspace
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Skip files that define the legacy wrappers themselves
    if (containsLegacyWrapperDefinitions(content)) {
      return;
    }

    let newContent = content;

    // Update imports to add legacy names
    newContent = updateLegacyCreatorImports(newContent, legacyCreators);

    // Update usages to use legacy names
    newContent = updateLegacyCreatorUsages(newContent, legacyCreators);

    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n✅ Updated legacy creator imports and usages in:');
    updatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function containsLegacyWrapperDefinitions(content: string): boolean {
  return content.includes('E.createLegacyQueryCreator');
}

function findLegacyWrappers(content: string): Map<string, string> {
  const wrappers = new Map<string, string>(); // original name -> legacy name
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // Find: export const legacyGetUsers = E.createLegacyQueryCreator({ creator: getUsers });
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.startsWith('legacy') &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;

      // Check if it's E.createLegacyQueryCreator
      if (
        ts.isPropertyAccessExpression(callExpr.expression) &&
        ts.isIdentifier(callExpr.expression.expression) &&
        callExpr.expression.expression.text === 'E' &&
        ts.isIdentifier(callExpr.expression.name) &&
        callExpr.expression.name.text === 'createLegacyQueryCreator'
      ) {
        // Extract the original creator name from the config object
        if (callExpr.arguments.length > 0 && ts.isObjectLiteralExpression(callExpr.arguments[0]!)) {
          const configObj = callExpr.arguments[0];

          configObj.properties.forEach((prop) => {
            if (
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'creator' &&
              ts.isIdentifier(prop.initializer)
            ) {
              const originalName = prop.initializer.text;
              const legacyName = (node.name as any).text;
              wrappers.set(originalName, legacyName);
            }
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return wrappers;
}

function updateLegacyCreatorImports(content: string, legacyCreators: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Update named imports to include legacy wrappers
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const namedBindings = node.importClause.namedBindings;
      const importedNames = new Set<string>();
      const newElements: string[] = [];
      let hasChanges = false;

      namedBindings.elements.forEach((element) => {
        const importedName = element.propertyName ? element.propertyName.text : element.name.text;
        const legacyName = legacyCreators.get(importedName);

        if (legacyName) {
          // Replace the original import with the legacy one
          hasChanges = true;
          newElements.push(legacyName);
          importedNames.add(legacyName);
        } else {
          // Keep imports that don't have legacy versions
          newElements.push(element.getText(sourceFile));
          importedNames.add(importedName);
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

function updateLegacyCreatorUsages(content: string, legacyCreators: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Handle object literal properties
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((prop) => {
        if (ts.isPropertyAssignment(prop)) {
          // Case: { get: getUsers } -> { get: legacyGetUsers }
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
          // Case: { getUsers } -> { getUsers: legacyGetUsers }
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

    // Handle regular identifier references
    if (ts.isIdentifier(node) && legacyCreators.has(node.text)) {
      const parent = node.parent;

      // Skip if it's a property name in an object literal (already handled above)
      if (ts.isPropertyAssignment(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip if it's the initializer in a property assignment (already handled above)
      if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip if it's a shorthand property (already handled above)
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

      // Replace with legacy name
      const newName = legacyCreators.get(node.text)!;
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
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
    const start = importStart;
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

//#region Turn AnyQuery into E.AnyLegacyQuery everywhere and do the same with AnyQueryCreator

function replaceAnyQueryWithLegacy(tree: Tree): void {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Only process if it contains AnyQuery or AnyQueryCreator
    if (!content.includes('AnyQuery') && !content.includes('AnyQueryCreator')) return;

    const newContent = replaceAnyQueryInFile(content);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n✅ Replaced AnyQuery and AnyQueryCreator with E.AnyLegacyQuery and E.AnyLegacyQueryCreator in:');
    updatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function replaceAnyQueryInFile(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Find type references to AnyQuery and AnyQueryCreator
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      if (node.typeName.text === 'AnyQuery') {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: 'E.AnyLegacyQuery',
        });
      } else if (node.typeName.text === 'AnyQueryCreator') {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: 'E.AnyLegacyQueryCreator',
        });
      }
    }

    // Find identifier references (for runtime usage)
    if (ts.isIdentifier(node) && (node.text === 'AnyQuery' || node.text === 'AnyQueryCreator')) {
      // Check if this is part of a type reference (already handled above)
      const parent = node.parent;
      if (ts.isTypeReferenceNode(parent) && parent.typeName === node) {
        ts.forEachChild(node, visit);
        return;
      }

      // Check if it's in an import statement
      if (ts.isImportSpecifier(parent)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Replace standalone references
      const replacement = node.text === 'AnyQuery' ? 'E.AnyLegacyQuery' : 'E.AnyLegacyQueryCreator';
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement,
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

  // Remove AnyQuery and AnyQueryCreator from imports and ensure ExperimentalQuery as E exists
  result = removeAnyQueryFromImports(result);

  // Make sure we have ExperimentalQuery as E import
  if (!result.includes('ExperimentalQuery as E')) {
    result = addExperimentalQueryImport(result);
  }

  return result;
}

function removeAnyQueryFromImports(content: string): string {
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
    (el) => el.name.text !== 'AnyQuery' && el.name.text !== 'AnyQueryCreator',
  );

  if (elementsToKeep.length === namedBindings.elements.length) {
    // Nothing to remove
    return content;
  }

  const importStart = queryImportNode.getStart(sourceFile);
  const importEnd = queryImportNode.getEnd();

  if (elementsToKeep.length === 0) {
    // Remove entire import statement
    const start = importStart;
    let end = importEnd;
    // Also remove the newline after the import
    if (content[end] === '\n') end++;
    return content.slice(0, start) + content.slice(end);
  }

  // Reconstruct import without AnyQuery and AnyQueryCreator
  const newImports = elementsToKeep.map((el) => el.getText(sourceFile));
  const moduleSpecifier = (queryImportNode.moduleSpecifier as ts.StringLiteral).text;
  const newImportStatement = `import { ${newImports.join(', ')} } from '${moduleSpecifier}';`;

  return content.slice(0, importStart) + newImportStatement + content.slice(importEnd);
}

//#endregion

//#region Generate inject functions for query client configs

function generateInjectFunctions(tree: Tree, queryClientFiles: Map<string, string[]>): void {
  const generatedFiles: string[] = [];

  for (const [filePath, configNames] of queryClientFiles.entries()) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    const newContent = addInjectFunctionsToFile(content, configNames);

    if (newContent !== content) {
      tree.write(filePath, newContent);
      generatedFiles.push(filePath);
    }
  }

  if (generatedFiles.length > 0) {
    console.log('\n✅ Generated inject functions in:');
    generatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function addInjectFunctionsToFile(content: string, configNames: string[]): string {
  // Add inject import if needed FIRST, before doing anything else
  let result = content;
  const hasInjectImport =
    result.includes('import { inject }') || (result.includes("from '@angular/core'") && result.includes('inject'));

  if (!hasInjectImport && configNames.length > 0) {
    result = addInjectImport(result);
  }

  // NOW parse the updated content to find config positions
  const sourceFile = ts.createSourceFile('temp.ts', result, ts.ScriptTarget.Latest, true);

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

        // Find the variable statement
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

  // Generate inject functions for each config
  const insertions: Array<{ position: number; text: string }> = [];

  for (const configName of configNames) {
    const position = configPositions.get(`${configName}Config`);
    if (!position) continue;

    // Check if inject function already exists
    const nameWithoutConfig = configName.replace(/Config$/, '');
    const capitalizedName = nameWithoutConfig.charAt(0).toUpperCase() + nameWithoutConfig.slice(1);
    const injectFunctionName = `inject${capitalizedName}`;

    if (result.includes(injectFunctionName)) continue;

    const injectFunction = generateInjectFunction(configName);
    insertions.push({ position, text: `\n\n${injectFunction}` });
  }

  // Apply insertions in reverse order to maintain positions
  insertions.sort((a, b) => b.position - a.position);
  for (const { position, text } of insertions) {
    result = result.slice(0, position) + text + result.slice(position);
  }

  return result;
}

function addInjectImport(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Find if there's already an import from @angular/core
  let angularCoreImport: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@angular/core'
    ) {
      angularCoreImport = node;
    }
  });

  if (angularCoreImport) {
    // Add inject to existing @angular/core import
    if (
      angularCoreImport.importClause?.namedBindings &&
      ts.isNamedImports(angularCoreImport.importClause.namedBindings)
    ) {
      const namedBindings = angularCoreImport.importClause.namedBindings;
      const existingImports = namedBindings.elements.map((el) => el.name.text);

      // Check if inject is already imported
      if (existingImports.includes('inject')) {
        return content;
      }

      const newImports = [...existingImports, 'inject'].sort();
      const newImportStatement = `import { ${newImports.join(', ')} } from '@angular/core';`;

      const importStart = angularCoreImport.getStart(sourceFile);
      const importEnd = angularCoreImport.getEnd();

      return content.slice(0, importStart) + newImportStatement + content.slice(importEnd);
    }
  }

  // Find the last import statement to insert after it
  let lastImportEnd = 0;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const end = node.getEnd();
      if (end > lastImportEnd) {
        lastImportEnd = end;
      }
    }
  });

  if (lastImportEnd > 0) {
    // Add after the last import
    const injectImport = `\nimport { inject } from '@angular/core';`;
    return content.slice(0, lastImportEnd) + injectImport + content.slice(lastImportEnd);
  }

  // No imports found, add at the beginning
  return `import { inject } from '@angular/core';\n\n${content}`;
}

function generateInjectFunction(configName: string): string {
  // Convert apiClientConfig -> injectApiClient
  const nameWithoutConfig = configName.replace(/Config$/, '');
  const capitalizedName = nameWithoutConfig.charAt(0).toUpperCase() + nameWithoutConfig.slice(1);
  const functionName = `inject${capitalizedName}`;

  return `export const ${functionName} = () => inject(${configName}Config.token);`;
}

//#endregion
