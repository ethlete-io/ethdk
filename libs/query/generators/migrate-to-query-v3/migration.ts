import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  ProjectGraph,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
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

    // Find and update dependent apps using project graph
    await updateDependentApps(tree, queryClientFiles);
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

async function updateDependentApps(tree: Tree, queryClientFiles: Map<string, string[]>): Promise<void> {
  const projects = getProjects(tree);
  const projectGraph = await createProjectGraphAsync();
  const updatedApps: string[] = [];

  // Build a map of project name -> config names it defines
  const projectToConfigs = new Map<string, Set<string>>();

  for (const [filePath, configNames] of queryClientFiles.entries()) {
    // Find which project this file belongs to
    for (const [projectName, projectConfig] of projects.entries()) {
      if (filePath.startsWith(projectConfig.root + '/')) {
        if (!projectToConfigs.has(projectName)) {
          projectToConfigs.set(projectName, new Set());
        }
        configNames.forEach((c) => projectToConfigs.get(projectName)!.add(c));
        break;
      }
    }
  }

  // Check if the project graph matches our workspace (test vs real)
  const projectNames = Array.from(projects.keys());
  const hasMatchingProjects = projectNames.some((name) => projectGraph.nodes[name] !== undefined);
  const useProjectGraph =
    hasMatchingProjects &&
    projectNames.every((name) => {
      // If it's a project in our tree, it should be in the graph
      const project = projects.get(name);
      return !project || projectGraph.nodes[name] !== undefined;
    });

  // For each application, find all transitive dependencies that define query clients
  for (const [projectName, projectConfig] of projects.entries()) {
    if (projectConfig.projectType !== 'application') continue;

    const importedConfigs = new Set<string>();

    if (useProjectGraph && projectGraph.nodes[projectName]) {
      // Use project graph for production - proper dependency resolution
      const dependencies = getAllTransitiveDependencies(projectGraph, projectName);

      // Check which of these dependencies define query client configs
      for (const depProject of dependencies) {
        const configs = projectToConfigs.get(depProject);
        if (configs) {
          configs.forEach((c) => {
            const configNameWithSuffix = ensureConfigSuffix(c);
            importedConfigs.add(configNameWithSuffix);
          });
        }
      }
    } else {
      // Fallback for test environment: scan all files in app directory for imports
      const allConfigNames = new Set<string>();
      queryClientFiles.forEach((configs) => configs.forEach((c) => allConfigNames.add(c)));

      visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
        if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

        const content = tree.read(filePath, 'utf-8');
        if (!content) return;

        for (const configName of allConfigNames) {
          const importRegex = new RegExp(`\\b${configName}\\b`);
          if (importRegex.test(content)) {
            const configNameWithSuffix = ensureConfigSuffix(configName);
            importedConfigs.add(configNameWithSuffix);
          }
        }
      });
    }

    if (importedConfigs.size > 0) {
      const configPaths = [`${projectConfig.root}/src/app/app.config.ts`, `${projectConfig.root}/src/main.ts`];

      for (const configPath of configPaths) {
        if (!tree.exists(configPath)) continue;

        const content = tree.read(configPath, 'utf-8');
        if (!content) continue;

        const newContent = addQueryClientProviders(content, Array.from(importedConfigs));
        if (newContent !== content) {
          tree.write(configPath, newContent);
          updatedApps.push(projectName);
          break;
        }
      }
    }
  }

  if (updatedApps.length > 0) {
    console.log('\n✅ Updated applications with query client providers:');
    updatedApps.forEach((app) => console.log(`   - ${app}`));
  }
}

function getAllTransitiveDependencies(projectGraph: ProjectGraph, projectName: string): Set<string> {
  const dependencies = new Set<string>();
  const visited = new Set<string>();

  function traverse(name: string) {
    if (visited.has(name)) return;
    visited.add(name);

    const node = projectGraph.dependencies[name];
    if (!node) return;

    for (const dep of node) {
      dependencies.add(dep.target);
      traverse(dep.target);
    }
  }

  traverse(projectName);
  return dependencies;
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

    let newContent = content;
    let modified = false;

    // Update imports
    const importUpdated = updateImportsInFile(content, renames);
    if (importUpdated !== content) {
      newContent = importUpdated;
      modified = true;
    }

    // Update variable references (not in declarations, those are already renamed)
    const referencesUpdated = updateVariableReferences(newContent, renames);
    if (referencesUpdated !== newContent) {
      newContent = referencesUpdated;
      modified = true;
    }

    if (modified) {
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
        const importedName = element.propertyName ? element.propertyName.text : element.name.text;
        const newName = renames.get(importedName);

        if (newName) {
          hasChanges = true;
          // If there's an alias, update the original name but keep the alias
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

function updateVariableReferences(content: string, renames: Map<string, string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Update variable references (but not in declarations or property names)
    if (ts.isIdentifier(node)) {
      const oldName = node.text;
      const newName = renames.get(oldName);

      if (newName) {
        const parent = node.parent;

        // Skip if it's a declaration
        if (ts.isVariableDeclaration(parent) && parent.name === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if it's a property name
        if (ts.isPropertyAssignment(parent) && parent.name === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if it's an import binding
        if (ts.isImportSpecifier(parent)) {
          ts.forEachChild(node, visit);
          return;
        }

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

//#region Remove provideQueryClientForDevtools and QueryDevtoolsComponent / et-query-devtools usage
// TODO
//#endregion
