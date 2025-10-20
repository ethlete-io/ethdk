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

  // Replace AnyV2Query with AnyLegacyQuery everywhere
  replaceAnyQueryWithLegacy(tree);

  // Remove devtools usage
  removeDevtoolsUsage(tree);

  // Migrate empty .prepare() calls to .prepare({})
  migrateEmptyPrepareCalls(tree);

  // Check for legacy query creator usage (step 1: just collect and report)
  checkLegacyQueryCreatorUsage(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
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
      const hasQueryClient = node.importClause.namedBindings.elements.some((el) => el.name.text === 'V2QueryClient');
      if (hasQueryClient) {
        hasQueryClientImport = true;
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'V2QueryClient') {
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
      node.expression.text === 'V2QueryClient' &&
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
  const elements = namedBindings.elements.filter((el) => el.name.text !== 'V2QueryClient');

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

  return `createQueryClientConfig({\n  ${newConfig.join(',\n  ')}\n})`;
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
    // Find: const XXX = createQueryClientConfig(...)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;
      if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'createQueryClientConfig') {
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

  const newProviders = clientConfigs.map((config) => `provideQueryClient(${config})`);

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
      if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'createQueryClientConfig') {
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
    `export const ${configNameWithoutClientSuffix}Get = createGetQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Post = createPostQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Put = createPutQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Patch = createPatchQuery(${configName}Config);`,
    `export const ${configNameWithoutClientSuffix}Delete = createDeleteQuery(${configName}Config);`,
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
  return `export const ${legacyName} = createLegacyQueryCreator({ creator: ${creator.name} });`;
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
      '\n⚠️ Make sure to provide them in the respective app.config/main.ts providers array using provideBearerAuthProvider(yourConfigName)',
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

export const ${clientName}AuthProviderConfig = createBearerAuthProviderConfig({
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
    `export const ${clientNameWithoutClient}GetSecure = createSecureGetQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}PostSecure = createSecurePostQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}PutSecure = createSecurePutQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}PatchSecure = createSecurePatchQuery(${configName}, ${authProviderName});`,
    `export const ${clientNameWithoutClient}DeleteSecure = createSecureDeleteQuery(${configName}, ${authProviderName});`,
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
  return content.includes('createLegacyQueryCreator');
}

function findLegacyWrappers(content: string): Map<string, string> {
  const wrappers = new Map<string, string>(); // original name -> legacy name
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // Find: export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.startsWith('legacy') &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;

      // Check if it's createLegacyQueryCreator
      if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'createLegacyQueryCreator') {
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

    // Handle regular identifier references - but skip declarations and property access names
    if (ts.isIdentifier(node) && legacyCreators.has(node.text)) {
      const parent = node.parent;

      // Skip if it's a property name in PropertyAccessExpression (e.g., obj.methodName)
      if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

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

      // Skip if it's a function/method name declaration
      if (ts.isFunctionDeclaration(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isMethodDeclaration(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip if it's a parameter name
      if (ts.isParameter(parent) && parent.name === node) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip if it's a property declaration name (class field)
      if (ts.isPropertyDeclaration(parent) && parent.name === node) {
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

//#region Turn AnyV2Query into AnyLegacyQuery everywhere and do the same with AnyV2QueryCreator

function replaceAnyQueryWithLegacy(tree: Tree): void {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Only process if it contains AnyV2Query or AnyV2QueryCreator
    if (!content.includes('AnyV2Query') && !content.includes('AnyV2QueryCreator')) return;

    const newContent = replaceAnyQueryInFile(content);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n✅ Replaced AnyV2Query and AnyV2QueryCreator with AnyLegacyQuery and AnyLegacyQueryCreator in:');
    updatedFiles.forEach((file) => console.log(`   - ${file}`));
  }
}

function replaceAnyQueryInFile(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Find type references to AnyV2Query and AnyV2QueryCreator
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      if (node.typeName.text === 'AnyV2Query') {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: 'AnyLegacyQuery',
        });
      } else if (node.typeName.text === 'AnyV2QueryCreator') {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: 'AnyLegacyQueryCreator',
        });
      }
    }

    // Find identifier references (for runtime usage)
    if (ts.isIdentifier(node) && (node.text === 'AnyV2Query' || node.text === 'AnyV2QueryCreator')) {
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
      const replacement = node.text === 'AnyV2Query' ? 'AnyLegacyQuery' : 'AnyLegacyQueryCreator';
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

  // Remove AnyV2Query and AnyV2QueryCreator from imports
  result = removeAnyQueryFromImports(result);

  // TODO
  // Make sure we have ExperimentalQuery as E import
  // if (!result.includes('ExperimentalQuery as E')) {
  //   result = addExperimentalQueryImport(result);
  // }

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
    (el) => el.name.text !== 'AnyV2Query' && el.name.text !== 'AnyV2QueryCreator',
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

  // Reconstruct import without AnyV2Query and AnyV2QueryCreator
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
      if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'createQueryClientConfig') {
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

//#region Check all files for usage of legacy query creators and add injector if needed

interface LegacyCreatorUsage {
  filePath: string;
  creatorName: string;
  line: number;
  position: { start: number; end: number };
  context: 'class-field' | 'constructor' | 'method' | 'queryComputed' | 'function' | 'unknown';
  hasExistingInjector: boolean;
}

function checkLegacyQueryCreatorUsage(tree: Tree): void {
  console.log('\n🔍 Checking for legacy query creator usages...');

  // Step 1: Collect all usages BEFORE any transformations
  const allUsages: LegacyCreatorUsage[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const usages = findLegacyCreatorUsages(content, filePath);
    allUsages.push(...usages);
  });

  if (allUsages.length === 0) {
    console.log('\n✅ No legacy query creator usages found');
    return;
  }

  console.log(`\n📊 Found ${allUsages.length} legacy query creator usages`);

  // Log statistics
  const contextCounts = new Map<string, number>();
  allUsages.forEach((usage) => {
    contextCounts.set(usage.context, (contextCounts.get(usage.context) || 0) + 1);
  });

  contextCounts.forEach((count, context) => {
    console.log(`   - ${context}: ${count} usages`);
  });

  // Step 1.5: Detect polling usage BEFORE any transformations
  console.log('\n🔍 Detecting polling usage...');
  const pollingInfo = detectPollingUsage(tree);

  if (pollingInfo.size > 0) {
    console.log(`\n⚠️  Found ${pollingInfo.size} queries with polling:`);
    pollingInfo.forEach((info) => {
      console.log(`   ${info.queryVariableName}:`);
      info.locations.forEach((loc) => console.log(`     - ${loc}`));
    });
    console.log('\n   → These queries will NOT have destroyOnResponse: true added');
  }

  // Step 2: Find or create injector members in classes
  const classInjectors = findOrCreateInjectorMembers(tree, allUsages);
  createInjectorMembers(tree, classInjectors);

  // Step 3: Transform prepare() calls with polling info
  transformLegacyCreatorPrepareCall(tree, classInjectors, pollingInfo);

  // Step 4: Report manual review locations (using original line numbers from allUsages)
  reportManualReviewLocations(tree, allUsages);
}

function findLegacyCreatorUsages(content: string, filePath: string): LegacyCreatorUsage[] {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const usages: LegacyCreatorUsage[] = [];

  // First, find all legacy query creator names imported/defined in this file
  const legacyCreatorNames = findLegacyCreatorNames(sourceFile, content);

  if (legacyCreatorNames.size === 0) {
    return usages;
  }

  // Now find all .prepare() calls on these creators
  function visit(node: ts.Node) {
    // Look for: legacyCreator.prepare()
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propAccess = node.expression;

      if (ts.isIdentifier(propAccess.name) && propAccess.name.text === 'prepare') {
        // Check if the object is a legacy creator
        let creatorName: string | undefined;

        if (ts.isIdentifier(propAccess.expression)) {
          creatorName = propAccess.expression.text;
        }

        if (creatorName && legacyCreatorNames.has(creatorName)) {
          const context = determineUsageContext(node, sourceFile);
          const hasInjector = checkForExistingInjector(node, sourceFile);
          const lineNumber = getLineNumber(node, sourceFile);

          usages.push({
            filePath,
            creatorName,
            line: lineNumber,
            position: {
              start: node.getStart(sourceFile),
              end: node.getEnd(),
            },
            context,
            hasExistingInjector: hasInjector,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return usages;
}

function findLegacyCreatorNames(sourceFile: ts.SourceFile, content: string): Set<string> {
  const names = new Set<string>();

  function visit(node: ts.Node) {
    // Find imports of legacy creators (names starting with 'legacy')
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      node.importClause.namedBindings.elements.forEach((element) => {
        const name = element.name.text;
        if (name.startsWith('legacy')) {
          names.add(name);
        }
      });
    }

    // Find local legacy creator definitions
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.startsWith('legacy') &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer;
      if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'createLegacyQueryCreator') {
        names.add(node.name.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return names;
}

function determineUsageContext(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): 'class-field' | 'constructor' | 'method' | 'queryComputed' | 'function' | 'unknown' {
  let current: ts.Node | undefined = node;

  while (current) {
    // Check for queryComputed FIRST (before checking for generic functions)
    // We need to look at the parent of arrow/function expressions
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const parent = current.parent;

      // Check if this function is a callback to queryComputed
      if (ts.isCallExpression(parent)) {
        const expr = parent.expression;

        // Check for queryComputed()
        if (ts.isIdentifier(expr) && expr.text === 'queryComputed') {
          return 'queryComputed';
        }
      }
    }

    // Check for constructor
    if (ts.isConstructorDeclaration(current)) {
      return 'constructor';
    }

    // Check for method
    if (ts.isMethodDeclaration(current)) {
      return 'method';
    }

    // Check for class field
    if (ts.isPropertyDeclaration(current)) {
      return 'class-field';
    }

    // Check for function declarations
    if (ts.isFunctionDeclaration(current)) {
      return 'function';
    }

    // Check for arrow functions and function expressions (standalone, not callbacks)
    // But make sure we're not inside a class (which would make it a method/field)
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && !isInsideClass(current)) {
      return 'function';
    }

    current = current.parent;
  }

  return 'unknown';
}

function isInsideClass(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isClassDeclaration(current)) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

function checkForExistingInjector(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  // Walk up to find the containing class
  let current: ts.Node | undefined = node;

  while (current && !ts.isClassDeclaration(current)) {
    current = current.parent;
  }

  if (!current || !ts.isClassDeclaration(current)) {
    return false;
  }

  const classDecl = current;

  // Check if class has any member that calls inject(Injector)
  for (const member of classDecl.members) {
    if (ts.isPropertyDeclaration(member) && member.initializer) {
      if (hasInjectInjectorCall(member.initializer)) {
        return true;
      }
    }

    if (ts.isConstructorDeclaration(member)) {
      for (const param of member.parameters) {
        if (param.initializer && hasInjectInjectorCall(param.initializer)) {
          return true;
        }
      }
    }
  }

  return false;
}

function hasInjectInjectorCall(node: ts.Node): boolean {
  let found = false;

  function visit(n: ts.Node) {
    if (found) return;

    // Look for: inject(Injector)
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'inject') {
      if (n.arguments.length > 0 && ts.isIdentifier(n.arguments[0]!) && n.arguments[0].text === 'Injector') {
        found = true;
        return;
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return found;
}

function getLineNumber(node: ts.Node, sourceFile: ts.SourceFile): number {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return line + 1;
}

//#endregion

//#region Step 2: Find or create injector member in classes

interface ClassWithInjector {
  filePath: string;
  className: string;
  injectorMemberName: string;
  needsToCreate: boolean;
  classStart: number;
  classEnd: number;
}

function findOrCreateInjectorMembers(tree: Tree, usages: LegacyCreatorUsage[]): Map<string, ClassWithInjector> {
  const classInjectors = new Map<string, ClassWithInjector>();

  // Group usages by file and class
  const usagesByFile = new Map<string, LegacyCreatorUsage[]>();
  usages.forEach((usage) => {
    // Skip usages that don't need injector (queryComputed, class-field, constructor)
    if (['queryComputed', 'class-field', 'constructor'].includes(usage.context)) {
      return;
    }

    if (!usagesByFile.has(usage.filePath)) {
      usagesByFile.set(usage.filePath, []);
    }
    usagesByFile.get(usage.filePath)!.push(usage);
  });

  // Process each file
  usagesByFile.forEach((fileUsages, filePath) => {
    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    // Find all classes in this file that have usages
    const classesNeedingInjector = findClassesNeedingInjector(sourceFile, fileUsages);

    classesNeedingInjector.forEach((classInfo) => {
      const key = `${filePath}:${classInfo.className}`;
      classInjectors.set(key, {
        ...classInfo,
        filePath,
      });
    });
  });

  return classInjectors;
}

function findClassesNeedingInjector(sourceFile: ts.SourceFile, usages: LegacyCreatorUsage[]): ClassWithInjector[] {
  const classes: ClassWithInjector[] = [];
  const actualFilePath = usages[0]?.filePath || sourceFile.fileName; // Get the real file path from usages

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.text || 'UnnamedClass';

      // Check if any usage is within this class
      const usagesInClass = usages.filter((usage) => {
        return usage.position.start >= node.getStart(sourceFile) && usage.position.end <= node.getEnd();
      });

      if (usagesInClass.length === 0) {
        ts.forEachChild(node, visit);
        return;
      }

      // Check if class already has an injector member
      const existingInjector = findExistingInjectorMember(node, sourceFile);

      if (existingInjector) {
        classes.push({
          filePath: actualFilePath,
          className,
          injectorMemberName: existingInjector.name,
          needsToCreate: false,
          classStart: node.getStart(sourceFile),
          classEnd: node.getEnd(),
        });
      } else {
        // Need to create one
        classes.push({
          filePath: actualFilePath,
          className,
          injectorMemberName: 'injector', // Default name
          needsToCreate: true,
          classStart: node.getStart(sourceFile),
          classEnd: node.getEnd(),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classes;
}

function findExistingInjectorMember(
  classNode: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
): { name: string; node: ts.PropertyDeclaration } | undefined {
  for (const member of classNode.members) {
    if (ts.isPropertyDeclaration(member) && member.initializer) {
      // Check if it's: inject(Injector)
      if (hasInjectInjectorCall(member.initializer)) {
        const memberName = member.name && ts.isIdentifier(member.name) ? member.name.text : undefined;
        if (memberName) {
          return { name: memberName, node: member };
        }
      }
    }
  }

  return undefined;
}

function createInjectorMembers(tree: Tree, classInjectors: Map<string, ClassWithInjector>): void {
  const filesToUpdate = new Map<string, ClassWithInjector[]>();

  // Group by file
  classInjectors.forEach((classInfo) => {
    if (!classInfo.needsToCreate) return;

    if (!filesToUpdate.has(classInfo.filePath)) {
      filesToUpdate.set(classInfo.filePath, []);
    }
    filesToUpdate.get(classInfo.filePath)!.push(classInfo);
  });

  // Update each file
  filesToUpdate.forEach((classes, filePath) => {
    let content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Add inject and Injector imports if needed
    content = ensureInjectAndInjectorImports(content);

    // Add injector member to each class (in reverse order to maintain positions)
    const sortedClasses = [...classes].sort((a, b) => b.classStart - a.classStart);

    for (const classInfo of sortedClasses) {
      content = addInjectorMemberToClass(content, classInfo);
    }

    tree.write(filePath, content);
  });

  if (filesToUpdate.size > 0) {
    console.log(`\n✅ Added injector members to ${Array.from(filesToUpdate.values()).flat().length} classes`);
  }
}

function ensureInjectAndInjectorImports(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

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

  const neededImports = new Set<string>();
  let hasInject = false;
  let hasInjector = false;

  if (
    angularCoreImport?.importClause?.namedBindings &&
    ts.isNamedImports(angularCoreImport.importClause.namedBindings)
  ) {
    const namedBindings = angularCoreImport.importClause.namedBindings;
    namedBindings.elements.forEach((el) => {
      if (el.name.text === 'inject') hasInject = true;
      if (el.name.text === 'Injector') hasInjector = true;
    });
  }

  if (!hasInject) neededImports.add('inject');
  if (!hasInjector) neededImports.add('Injector');

  if (neededImports.size === 0) {
    return content; // Already has both imports
  }

  if (
    angularCoreImport?.importClause?.namedBindings &&
    ts.isNamedImports(angularCoreImport.importClause.namedBindings)
  ) {
    // Add to existing import
    const namedBindings = angularCoreImport.importClause.namedBindings;
    const existingImports = namedBindings.elements.map((el) => el.name.text);
    const allImports = [...existingImports, ...Array.from(neededImports)].sort();

    const newImportStatement = `import { ${allImports.join(', ')} } from '@angular/core';`;

    const importStart = angularCoreImport.getStart(sourceFile);
    const importEnd = angularCoreImport.getEnd();

    return content.slice(0, importStart) + newImportStatement + content.slice(importEnd);
  }

  // Find last import to add after it
  let lastImportEnd = 0;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const end = node.getEnd();
      if (end > lastImportEnd) {
        lastImportEnd = end;
      }
    }
  });

  const newImports = Array.from(neededImports).sort();
  const newImportStatement = `\nimport { ${newImports.join(', ')} } from '@angular/core';`;

  if (lastImportEnd > 0) {
    return content.slice(0, lastImportEnd) + newImportStatement + content.slice(lastImportEnd);
  }

  return `import { ${newImports.join(', ')} } from '@angular/core';\n\n${content}`;
}

function addInjectorMemberToClass(content: string, classInfo: ClassWithInjector): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  // Find the class
  let targetClass: ts.ClassDeclaration | undefined;

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.text;
      if (className === classInfo.className) {
        targetClass = node;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!targetClass) return content;

  // Find where to insert the injector member (after the opening brace)
  const classBodyStart =
    targetClass.members.length > 0 ? targetClass.members[0]!.getStart(sourceFile) : targetClass.getEnd() - 1; // Before closing brace

  const indentation = getIndentation(content, classBodyStart);
  const injectorMember = `${indentation}private ${classInfo.injectorMemberName} = inject(Injector);\n\n`;

  return content.slice(0, classBodyStart) + injectorMember + content.slice(classBodyStart);
}

function getIndentation(content: string, position: number): string {
  // Walk backwards to find the start of the line
  let lineStart = position;
  while (lineStart > 0 && content[lineStart - 1] !== '\n') {
    lineStart--;
  }

  // Count spaces/tabs
  let indentation = '';
  for (let i = lineStart; i < position && /\s/.test(content[i]!); i++) {
    indentation += content[i];
  }

  return indentation || '  '; // Default to 2 spaces if no indentation found
}

//#endregion

//#region Step 3: Transform legacy query creator prepare() calls to add injector

function transformLegacyCreatorPrepareCall(
  tree: Tree,
  classInjectors: Map<string, ClassWithInjector>,
  pollingInfo: Map<string, QueryPollingInfo>,
): void {
  const updatedFiles: string[] = [];

  // Get all files that have classes with injector OR have standalone function usages
  const filesByPath = new Map<string, ClassWithInjector[]>();
  classInjectors.forEach((classInfo) => {
    if (!filesByPath.has(classInfo.filePath)) {
      filesByPath.set(classInfo.filePath, []);
    }
    filesByPath.get(classInfo.filePath)!.push(classInfo);
  });

  // Also check files with standalone function usages
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;
    if (filesByPath.has(filePath)) return; // Already processing

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Only analyze files that have .prepare() calls
    if (!content.includes('.prepare(')) return;

    const usages = findLegacyCreatorUsages(content, filePath);
    const functionUsages = usages.filter((u) => u.context === 'function');

    if (functionUsages.length > 0) {
      filesByPath.set(filePath, []); // Empty array means standalone functions only
    }
  });

  filesByPath.forEach((classes, filePath) => {
    let content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Ensure imports are added (for both classes and functions)
    content = ensureInjectAndInjectorImports(content);

    // Transform prepare calls for each class and functions
    const newContent = transformPrepareCallsInFile(content, classes, pollingInfo);

    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log(`\n✅ Transformed legacy query creator prepare() calls in ${updatedFiles.length} files`);
  }
}

function transformPrepareCallsInFile(
  content: string,
  classes: ClassWithInjector[],
  pollingInfo: Map<string, QueryPollingInfo>,
): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  // Find all legacy creator names
  const legacyCreatorNames = findLegacyCreatorNames(sourceFile, content);
  if (legacyCreatorNames.size === 0) return content;

  // Build a map of class NAME to their injector member name
  const classNameToInjector = new Map<string, string>();
  classes.forEach((classInfo) => {
    classNameToInjector.set(classInfo.className, classInfo.injectorMemberName);
  });

  // Track standalone functions that need injector by their position
  const functionsNeedingInjector = new Map<
    number,
    { injectorName: string; bodyStart: number; needsDeclaration: boolean }
  >();

  function visit(node: ts.Node) {
    // Find: legacyCreator.prepare(...)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propAccess = node.expression;

      if (ts.isIdentifier(propAccess.name) && propAccess.name.text === 'prepare') {
        let creatorName: string | undefined;

        if (ts.isIdentifier(propAccess.expression)) {
          creatorName = propAccess.expression.text;
        }

        if (!creatorName || !legacyCreatorNames.has(creatorName)) {
          ts.forEachChild(node, visit);
          return;
        }

        // Check if this is in a context that needs injector
        const context = determineUsageContext(node, sourceFile);
        if (['queryComputed', 'constructor', 'class-field'].includes(context)) {
          // Safe contexts that don't need injector or destroyOnResponse
          ts.forEachChild(node, visit);
          return;
        }

        // Find the containing class or function
        const containingClass = findContainingClass(node, sourceFile);
        const containingFunction = findContainingStandaloneFunction(node, sourceFile);

        if (containingClass) {
          // Handle class method (NOT class fields - they were filtered above)
          const className = containingClass.name?.text;
          if (!className) {
            ts.forEachChild(node, visit);
            return;
          }

          const injectorMember = classNameToInjector.get(className);
          if (!injectorMember) {
            ts.forEachChild(node, visit);
            return;
          }

          // Transform the prepare call
          const transformedCall = transformSinglePrepareCall(node, `this.${injectorMember}`, sourceFile, pollingInfo);
          if (transformedCall) {
            replacements.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement: transformedCall,
            });
          }
        } else if (containingFunction) {
          // Handle standalone function - find the outermost function with inject()
          const functionWithInject = findOutermostFunctionWithInject(containingFunction, sourceFile);

          if (functionWithInject) {
            const funcPosition = functionWithInject.getStart(sourceFile);

            // Check if we haven't already processed this function
            if (!functionsNeedingInjector.has(funcPosition)) {
              // Check if the function already has an injector parameter
              const existingInjectorParam = findInjectorParameter(functionWithInject);

              if (existingInjectorParam) {
                // Use the existing parameter name
                functionsNeedingInjector.set(funcPosition, {
                  injectorName: existingInjectorParam,
                  bodyStart: -1, // No declaration needed
                  needsDeclaration: false,
                });
              } else {
                // Need to declare injector
                let bodyStart: number | undefined;

                if (
                  (ts.isFunctionDeclaration(functionWithInject) || ts.isFunctionExpression(functionWithInject)) &&
                  functionWithInject.body &&
                  ts.isBlock(functionWithInject.body)
                ) {
                  if (functionWithInject.body.statements.length > 0) {
                    bodyStart = functionWithInject.body.statements[0]!.getStart(sourceFile);
                  } else {
                    bodyStart = functionWithInject.body.getStart(sourceFile) + 1;
                  }
                } else if (
                  ts.isArrowFunction(functionWithInject) &&
                  functionWithInject.body &&
                  ts.isBlock(functionWithInject.body)
                ) {
                  if (functionWithInject.body.statements.length > 0) {
                    bodyStart = functionWithInject.body.statements[0]!.getStart(sourceFile);
                  } else {
                    bodyStart = functionWithInject.body.getStart(sourceFile) + 1;
                  }
                }

                if (bodyStart !== undefined) {
                  functionsNeedingInjector.set(funcPosition, {
                    injectorName: 'injector',
                    bodyStart,
                    needsDeclaration: true,
                  });
                }
              }
            }

            const injectorInfo = functionsNeedingInjector.get(funcPosition);
            const injectorName = injectorInfo?.injectorName || 'injector';

            // Transform the prepare call
            const transformedCall = transformSinglePrepareCall(node, injectorName, sourceFile, pollingInfo);
            if (transformedCall) {
              replacements.push({
                start: node.getStart(sourceFile),
                end: node.getEnd(),
                replacement: transformedCall,
              });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply injector declarations first (in reverse order) - only for functions that need them
  let result = content;
  const injectorDeclarations: Array<{ position: number; text: string }> = [];

  functionsNeedingInjector.forEach(({ injectorName, bodyStart, needsDeclaration }) => {
    if (needsDeclaration && bodyStart > 0) {
      const indentation = getIndentation(content, bodyStart);
      const injectorDecl = `${indentation}const ${injectorName} = inject(Injector);\n`;

      injectorDeclarations.push({
        position: bodyStart,
        text: injectorDecl,
      });
    }
  });

  injectorDeclarations.sort((a, b) => b.position - a.position);
  for (const { position, text } of injectorDeclarations) {
    result = result.slice(0, position) + text + result.slice(position);
  }

  // Then apply prepare call replacements (need to adjust positions for injector insertions)
  const sortedReplacements = [...replacements].sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of sortedReplacements) {
    // Calculate position adjustment from injector declarations that came before this replacement
    let adjustment = 0;
    for (const decl of injectorDeclarations) {
      if (decl.position <= start) {
        adjustment += decl.text.length;
      }
    }

    result = result.slice(0, start + adjustment) + replacement + result.slice(end + adjustment);
  }

  return result;
}

function findInjectorParameter(
  func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
): string | undefined {
  if (!func.parameters || func.parameters.length === 0) {
    return undefined;
  }

  // Look for a parameter named 'injector' or with a type containing 'Injector'
  for (const param of func.parameters) {
    if (ts.isIdentifier(param.name)) {
      const paramName = param.name.text;

      // Check if parameter is named 'injector'
      if (paramName.toLowerCase() === 'injector') {
        return paramName;
      }

      // Check if parameter type contains 'Injector'
      if (param.type) {
        const typeText = param.type.getText();
        if (typeText.includes('Injector')) {
          return paramName;
        }
      }
    }
  }

  return undefined;
}

function findOutermostFunctionWithInject(
  startFunction: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
  let current: ts.Node | undefined = startFunction;
  let outermostWithInject: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined;

  // Walk up the tree looking for functions with inject() calls
  while (current) {
    // Stop if we hit a class - we don't want to go outside the function scope
    if (ts.isClassDeclaration(current)) {
      break;
    }

    // Check if this is a function with inject()
    if (
      (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      containsInjectCall(current)
    ) {
      outermostWithInject = current;
    }

    current = current.parent;
  }

  return outermostWithInject;
}

function findContainingStandaloneFunction(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
  let current: ts.Node | undefined = node;

  while (current) {
    // Check if we hit a class first - then it's not a standalone function
    if (ts.isClassDeclaration(current)) {
      return undefined;
    }

    // Check for function declarations, arrow functions, or function expressions
    if (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      return current;
    }

    current = current.parent;
  }

  return undefined;
}

function findOrCreateInjectorInFunction(
  func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
  functionsNeedingInjector: Map<ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression, string>,
): string | undefined {
  // Check if function already has an injector variable
  const existingInjector = findExistingInjectorVariable(func, sourceFile);
  if (existingInjector) {
    return existingInjector;
  }

  // Check if we already marked this function for injector creation
  const existing = functionsNeedingInjector.get(func);
  if (existing) {
    return existing;
  }

  // Mark for creation
  const injectorName = 'injector';
  functionsNeedingInjector.set(func, injectorName);
  return injectorName;
}

function findExistingInjectorVariable(
  func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
): string | undefined {
  const body = func.body;
  if (!body || !ts.isBlock(body)) {
    return undefined;
  }

  for (const statement of body.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          hasInjectInjectorCall(declaration.initializer)
        ) {
          return declaration.name.text;
        }
      }
    }
  }

  return undefined;
}

function findContainingClass(node: ts.Node, sourceFile: ts.SourceFile): ts.ClassDeclaration | undefined {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current)) {
      return current;
    }
    current = current.parent;
  }

  return undefined;
}

function transformSinglePrepareCall(
  callNode: ts.CallExpression,
  injectorReference: string,
  sourceFile: ts.SourceFile,
  pollingInfo: Map<string, QueryPollingInfo>,
): string | undefined {
  const propAccess = callNode.expression as ts.PropertyAccessExpression;
  const creatorName = (propAccess.expression as ts.Identifier).text;

  // Get existing arguments
  const existingArgs = callNode.arguments.length > 0 ? callNode.arguments[0] : undefined;

  // Build new argument object
  const newArgProperties: string[] = [];
  let existingConfig: ts.PropertyAssignment | undefined;
  let needsSpread = false;
  let spreadExpression: string | undefined;

  // If there's an existing argument and it's an object literal, extract its properties
  if (existingArgs) {
    if (ts.isObjectLiteralExpression(existingArgs)) {
      existingArgs.properties.forEach((prop) => {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const propName = prop.name.text;

          // Handle config specially - we need to merge it
          if (propName === 'config') {
            existingConfig = prop;
            return; // Don't add it yet
          }

          const propValue = prop.initializer.getText(sourceFile);
          newArgProperties.push(`${propName}: ${propValue}`);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          const propName = prop.name.text;
          newArgProperties.push(propName);
        } else if (ts.isSpreadAssignment(prop)) {
          // Existing spread - preserve it
          spreadExpression = prop.expression.getText(sourceFile);
          needsSpread = true;
        }
      });
    } else {
      // If it's not an object literal (e.g., a variable or expression), we need to spread it
      spreadExpression = existingArgs.getText(sourceFile);
      needsSpread = true;
    }
  }

  // Add injector
  newArgProperties.push(`injector: ${injectorReference}`);

  // Conditionally add or merge config
  const queryVariableName = findQueryVariableNameForPrepareCall(callNode, sourceFile);
  const addDestroyOnResponse = shouldAddDestroyOnResponse(queryVariableName, pollingInfo);

  if (existingConfig) {
    // Merge with existing config
    const existingConfigObj = existingConfig.initializer;

    if (ts.isObjectLiteralExpression(existingConfigObj)) {
      const configProps: string[] = [];

      // Add existing config properties
      existingConfigObj.properties.forEach((prop) => {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const propName = prop.name.text;
          const propValue = prop.initializer.getText(sourceFile);
          configProps.push(`${propName}: ${propValue}`);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          const propName = prop.name.text;
          configProps.push(propName);
        }
      });

      // Add destroyOnResponse if needed
      if (addDestroyOnResponse) {
        configProps.push('destroyOnResponse: true');
      }

      if (configProps.length > 2) {
        newArgProperties.push(`config: {\n    ${configProps.join(',\n    ')}\n  }`);
      } else {
        newArgProperties.push(`config: { ${configProps.join(', ')} }`);
      }
    } else {
      // Config is not an object literal (e.g., a variable) - can't merge
      // Just keep the existing config
      newArgProperties.push(`config: ${existingConfigObj.getText(sourceFile)}`);
    }
  } else if (addDestroyOnResponse) {
    // No existing config - add destroyOnResponse
    newArgProperties.push(`config: { destroyOnResponse: true }`);
  }

  // Format based on whether we need to spread and number of properties
  let argsString: string;

  if (needsSpread && spreadExpression) {
    // Need to spread the existing argument
    if (newArgProperties.length <= 2 && !newArgProperties.some((p) => p.includes('\n'))) {
      // Single line for short objects
      argsString = `{ ...${spreadExpression}, ${newArgProperties.join(', ')} }`;
    } else {
      // Multi-line for longer objects
      argsString = `{\n  ...${spreadExpression},\n  ${newArgProperties.join(',\n  ')}\n}`;
    }
  } else {
    // No spread needed
    if (newArgProperties.length <= 2 && !newArgProperties.some((p) => p.includes('\n'))) {
      // Single line for short objects
      argsString = `{ ${newArgProperties.join(', ')} }`;
    } else {
      // Multi-line for longer objects
      argsString = `{\n  ${newArgProperties.join(',\n  ')}\n}`;
    }
  }

  return `${creatorName}.prepare(${argsString})`;
}

function findQueryVariableNameForPrepareCall(
  prepareCallNode: ts.CallExpression,
  sourceFile: ts.SourceFile,
): string | undefined {
  // Walk up to find if this prepare call is assigned to a variable
  // e.g., const query = legacyGetUsers.prepare()
  let parent = prepareCallNode.parent;

  while (parent) {
    // Check if assigned to a variable
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    // Check if assigned to a class property
    if (ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    // Check if it's a return statement - look for the method/function name
    if (ts.isReturnStatement(parent)) {
      const containingFunction = findContainingMethod(parent, sourceFile);
      if (containingFunction) {
        return containingFunction;
      }
    }

    parent = parent.parent;
  }

  return undefined;
}

function findContainingMethod(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }

    if (ts.isFunctionDeclaration(current) && current.name && ts.isIdentifier(current.name)) {
      return current.name.text;
    }

    if (ts.isArrowFunction(current)) {
      // Check if it's assigned to a variable
      const parent = current.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
    }

    current = current.parent;
  }

  return undefined;
}

//#endregion

//#region Step 4: Report manual review locations

interface ManualReviewLocation {
  filePath: string;
  line: number;
  creatorName: string;
  reason: string;
}

function reportManualReviewLocations(tree: Tree, allUsages: LegacyCreatorUsage[]): void {
  const needsReview: ManualReviewLocation[] = [];

  allUsages.forEach((usage) => {
    // Check if this usage needs manual review
    if (usage.context === 'function') {
      // For function context, we need to check if it was in a function WITHOUT inject()
      // This means it should have been flagged for manual review during transformation

      // We can check if the function had inject by looking at the original file
      // (before transformation) since we need to report the original line number anyway
      const originalContent = tree.read(usage.filePath, 'utf-8');
      if (!originalContent) return;

      // Parse the CURRENT file to check if inject was added
      // But use the ORIGINAL line number from usage
      const sourceFile = ts.createSourceFile(usage.filePath, originalContent, ts.ScriptTarget.Latest, true);

      // Find any function that contains a .prepare() call around the original position
      let foundFunctionWithoutInject = false;

      function checkFunctions(node: ts.Node) {
        // Look for functions that might contain our usage
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
          const funcStart = node.getStart(sourceFile);
          const funcEnd = node.getEnd();

          // Check if our usage position is within this function
          if (usage.position.start >= funcStart && usage.position.end <= funcEnd) {
            // Check if this function or any parent function has inject()
            if (!containsInjectCall(node) && !findOutermostFunctionWithInject(node, sourceFile)) {
              foundFunctionWithoutInject = true;
            }
          }
        }
        ts.forEachChild(node, checkFunctions);
      }

      checkFunctions(sourceFile);

      if (foundFunctionWithoutInject) {
        needsReview.push({
          filePath: usage.filePath,
          line: usage.line, // Use the original line number from Step 1
          creatorName: usage.creatorName,
          reason: 'Used in standalone function without inject() - may need manual injector passing',
        });
      }
    } else if (usage.context === 'unknown') {
      needsReview.push({
        filePath: usage.filePath,
        line: usage.line, // Use the original line number from Step 1
        creatorName: usage.creatorName,
        reason: 'Could not determine execution context - please verify manually',
      });
    }
  });

  if (needsReview.length > 0) {
    console.warn(`\n⚠️  Found ${needsReview.length} locations that may need manual review:`);

    // Group by file for cleaner output
    const byFile = new Map<string, ManualReviewLocation[]>();
    needsReview.forEach((location) => {
      if (!byFile.has(location.filePath)) {
        byFile.set(location.filePath, []);
      }
      byFile.get(location.filePath)!.push(location);
    });

    byFile.forEach((locations, filePath) => {
      console.warn(`\n   📄 ${filePath}:`);
      locations.forEach((location) => {
        console.warn(`      Line ${location.line}: ${location.creatorName}`);
        console.warn(`         → ${location.reason}`);
      });
    });

    console.warn('\n💡 Solve these warnings by:');
    console.warn(
      '   - [HIGHLY RECOMMENDED] Passing an injector as a parameter to the prepare method call alongside a config: { destroyOnResponse: true }',
    );
    console.warn('   - Using queryComputed() if appropriate');
    console.warn('   - Putting the prepare call into an injection context');
  }
}

//#endregion

//#region Helper functions for inject detection

function containsInjectCall(node: ts.Node): boolean {
  let hasInject = false;

  function visit(n: ts.Node) {
    if (hasInject) return;

    // Check for direct inject() call
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'inject') {
      hasInject = true;
      return;
    }

    // Check for any function call that starts with "inject"
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (n.expression.text.startsWith('inject')) {
        hasInject = true;
        return;
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return hasInject;
}

//#endregion

//#region Migrate empty .prepare() calls to .prepare({})

function migrateEmptyPrepareCalls(tree: Tree): void {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Only analyze files that have .prepare() calls
    if (!content.includes('.prepare()')) return;

    const newContent = transformEmptyPrepareCalls(content);
    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log(`\n✅ Migrated empty .prepare() calls to .prepare({}) in ${updatedFiles.length} files`);
  }
}

function transformEmptyPrepareCalls(content: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Find: something.prepare()
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propAccess = node.expression;

      if (ts.isIdentifier(propAccess.name) && propAccess.name.text === 'prepare') {
        // Check if it has no arguments
        if (node.arguments.length === 0) {
          // Get the full text of the call: "something.prepare()"
          const callStart = node.getStart(sourceFile);
          const callEnd = node.getEnd();
          const callText = content.slice(callStart, callEnd);

          // Replace with: "something.prepare({})"
          const replacement = callText.replace(/\.prepare\(\)/, '.prepare({})');

          replacements.push({
            start: callStart,
            end: callEnd,
            replacement,
          });
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

  return result;
}

//#endregion

//#region Detect polling usage to conditionally add destroyOnResponse

interface QueryPollingInfo {
  queryVariableName: string;
  hasPolling: boolean;
  locations: string[]; // Where polling was detected
}

function detectPollingUsage(tree: Tree): Map<string, QueryPollingInfo> {
  const pollingInfo = new Map<string, QueryPollingInfo>();

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Check TypeScript files
    if (filePath.endsWith('.ts')) {
      detectPollingInTypeScript(content, filePath, pollingInfo);
    }

    // Check HTML templates
    if (filePath.endsWith('.html')) {
      detectPollingInTemplate(content, filePath, pollingInfo);
    }
  });

  return pollingInfo;
}

function detectPollingInTypeScript(
  content: string,
  filePath: string,
  pollingInfo: Map<string, QueryPollingInfo>,
): void {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // Find .poll() or .stopPolling() calls
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propAccess = node.expression;
      const methodName = propAccess.name;

      if (ts.isIdentifier(methodName) && (methodName.text === 'poll' || methodName.text === 'stopPolling')) {
        // Walk back to find the root variable name
        const queryVariableName = getQueryVariableName(propAccess.expression, sourceFile);

        if (queryVariableName) {
          const existing = pollingInfo.get(queryVariableName);
          if (existing) {
            existing.hasPolling = true;
            existing.locations.push(`${filePath}:${getLineNumber(node, sourceFile)} (.${methodName.text})`);
          } else {
            pollingInfo.set(queryVariableName, {
              queryVariableName,
              hasPolling: true,
              locations: [`${filePath}:${getLineNumber(node, sourceFile)} (.${methodName.text})`],
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function getQueryVariableName(expr: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
  // Walk back through the chain to find the root variable
  let current: ts.Expression = expr;

  while (true) {
    if (ts.isIdentifier(current)) {
      return current.text;
    }

    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }

    if (ts.isCallExpression(current)) {
      // For chained calls like query.prepare().execute().poll()
      // We want to get the root query variable
      current = current.expression;
      continue;
    }

    // Can't determine the root variable
    return undefined;
  }
}

function detectPollingInTemplate(content: string, filePath: string, pollingInfo: Map<string, QueryPollingInfo>): void {
  // Use regex to find .poll() or .stopPolling() in templates
  // This is not perfect but catches most cases

  const pollRegex = /(\w+)\.poll\(\)/g;
  const stopPollingRegex = /(\w+)\.stopPolling\(\)/g;

  let match: RegExpExecArray | null;

  // Find .poll() calls
  while ((match = pollRegex.exec(content)) !== null) {
    const queryVariableName = match[1]!;
    const lineNumber = getLineNumberFromPosition(content, match.index);

    const existing = pollingInfo.get(queryVariableName);
    if (existing) {
      existing.hasPolling = true;
      existing.locations.push(`${filePath}:${lineNumber} (.poll() in template)`);
    } else {
      pollingInfo.set(queryVariableName, {
        queryVariableName,
        hasPolling: true,
        locations: [`${filePath}:${lineNumber} (.poll() in template)`],
      });
    }
  }

  // Find .stopPolling() calls
  while ((match = stopPollingRegex.exec(content)) !== null) {
    const queryVariableName = match[1]!;
    const lineNumber = getLineNumberFromPosition(content, match.index);

    const existing = pollingInfo.get(queryVariableName);
    if (existing) {
      existing.hasPolling = true;
      existing.locations.push(`${filePath}:${lineNumber} (.stopPolling() in template)`);
    } else {
      pollingInfo.set(queryVariableName, {
        queryVariableName,
        hasPolling: true,
        locations: [`${filePath}:${lineNumber} (.stopPolling() in template)`],
      });
    }
  }
}

function getLineNumberFromPosition(content: string, position: number): number {
  const lines = content.slice(0, position).split('\n');
  return lines.length;
}

function shouldAddDestroyOnResponse(
  queryVariableName: string | undefined,
  pollingInfo: Map<string, QueryPollingInfo>,
): boolean {
  if (!queryVariableName) {
    // Can't determine - be conservative and don't add destroyOnResponse
    return false;
  }

  const info = pollingInfo.get(queryVariableName);

  // If we found polling usage, don't add destroyOnResponse
  if (info && info.hasPolling) {
    return false;
  }

  // No polling detected - safe to add destroyOnResponse
  return true;
}

//#endregion
