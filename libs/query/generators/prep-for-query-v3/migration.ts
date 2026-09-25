import { Tree, formatFiles, joinPathFragments, readJson, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';
import {
  REMOVED_EXPERIMENTAL_QUERY_HELPERS,
  createSourceFile,
  findRemovedExperimentalQueryHelpers,
} from '../migrate-to-query-v3/shared.js';

//#region Migration main

type MigrationSchema = {
  skipFormat?: boolean;
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting Query v3 symbol conflict migration...');

  renameConflictingSymbols(tree);
  replaceExperimentalQueryNamespace(tree);
  reportPrebuiltPackagesImportingRenamedSymbols(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Migration completed successfully!');
}

//#endregion

//#region Symbol renaming

// Map of old symbol names to new symbol names
const TYPE_RENAMES = new Map<string, string>([
  ['BearerAuthProvider', 'V2BearerAuthProvider'],
  ['AnyQueryCreator', 'AnyV2QueryCreator'],
  ['CacheAdapterFn', 'V2CacheAdapterFn'],
  ['Query', 'V2Query'],
  ['QueryArgsOf', 'V2QueryArgsOf'],
  ['QueryClient', 'V2QueryClient'],
  ['QueryClientConfig', 'V2QueryClientConfig'],
  ['QueryConfig', 'V2QueryConfig'],
  ['QueryCreator', 'V2QueryCreator'],
  ['QueryState', 'V2QueryState'],
  ['RouteType', 'V2RouteType'],
  ['RouteString', 'V2RouteString'],
  ['AnyQuery', 'AnyV2Query'],
]);

const FUNCTION_RENAMES = new Map<string, string>([
  ['buildQueryCacheKey', 'v2BuildQueryCacheKey'],
  ['extractExpiresInSeconds', 'v2ExtractExpiresInSeconds'],
  ['shouldCacheQuery', 'v2ShouldCacheQuery'],
  ['shouldRetryRequest', 'v2ShouldRetryRequest'],
]);

function renameConflictingSymbols(tree: Tree): void {
  const updatedFiles: string[] = [];
  const symbolUsageCounts = new Map<string, number>();

  // Initialize counts
  [...TYPE_RENAMES.keys(), ...FUNCTION_RENAMES.keys()].forEach((symbol) => {
    symbolUsageCounts.set(symbol, 0);
  });

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Check if file imports from @ethlete/query
    if (!content.includes('@ethlete/query')) return;

    const newContent = renameSymbolsInFile(content, filePath, symbolUsageCounts);

    if (newContent !== content) {
      tree.write(filePath, newContent);
      updatedFiles.push(filePath);
    }
  });

  // Log statistics
  if (updatedFiles.length > 0) {
    console.log(`\n📊 Renamed symbols in ${updatedFiles.length} files:`);

    const hasRenames = Array.from(symbolUsageCounts.entries()).filter(([, count]) => count > 0);

    if (hasRenames.length > 0) {
      console.log('\n   Symbol usage counts:');
      hasRenames.forEach(([symbol, count]) => {
        const newName = TYPE_RENAMES.get(symbol) || FUNCTION_RENAMES.get(symbol);
        console.log(`   - ${symbol} → ${newName}: ${count} occurrences`);
      });
    }
  } else {
    console.log('\n✅ No conflicting symbols found in workspace');
  }
}

function renameSymbolsInFile(content: string, filePath: string, symbolUsageCounts: Map<string, number>): string {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string; oldName: string }> = [];

  // Track which symbols are imported from @ethlete/query
  const importedSymbols = new Set<string>();
  const namespaceAliases = collectQueryNamespaceAliases(sourceFile);

  function visit(node: ts.Node) {
    const namespaceMember = getNamespaceMember(node, namespaceAliases)?.member;
    const renamedMember =
      namespaceMember && (TYPE_RENAMES.get(namespaceMember.text) || FUNCTION_RENAMES.get(namespaceMember.text));

    if (namespaceMember && renamedMember) {
      replacements.push({
        start: namespaceMember.getStart(sourceFile),
        end: namespaceMember.getEnd(),
        replacement: renamedMember,
        oldName: namespaceMember.text,
      });
    }

    // Track imports from @ethlete/query
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/query') {
        const namedBindings = node.importClause?.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => {
            const importedName = element.propertyName?.text || element.name.text;
            if (TYPE_RENAMES.has(importedName) || FUNCTION_RENAMES.has(importedName)) {
              importedSymbols.add(importedName);
            }
          });
        }
      }
    }

    // Rename identifiers that match our rename maps
    if (ts.isIdentifier(node)) {
      const name = node.text;
      const parent = node.parent;

      // Only rename if this symbol was imported from @ethlete/query
      if (!importedSymbols.has(name)) {
        ts.forEachChild(node, visit);
        return;
      }

      const newName = TYPE_RENAMES.get(name) || FUNCTION_RENAMES.get(name);
      if (!newName) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip if it's the imported name in an import specifier (we'll handle that separately)
      if (
        (ts.isImportSpecifier(parent) && (parent.propertyName === node || parent.name === node)) ||
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isQualifiedName(parent) && parent.right === node)
      ) {
        ts.forEachChild(node, visit);
        return;
      }

      // Rename the identifier
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: newName,
        oldName: name,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Update imports in @ethlete/query import declarations
  const importReplacements = updateImports(sourceFile);
  replacements.push(...importReplacements);

  // Count usages
  replacements.forEach((r) => {
    const count = symbolUsageCounts.get(r.oldName) || 0;
    symbolUsageCounts.set(r.oldName, count + 1);
  });

  // Apply replacements in reverse order
  let result = content;
  replacements.sort((a, b) => b.start - a.start);

  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

function collectQueryNamespaceAliases(sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>();

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return;
    }

    const namedBindings = statement.importClause?.namedBindings;

    if (
      namedBindings &&
      ts.isNamespaceImport(namedBindings) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@ethlete/query'
    ) {
      aliases.add(namedBindings.name.text);
    }
  });

  return aliases;
}

function getNamespaceMember(
  node: ts.Node,
  namespaceAliases: Set<string>,
): { namespace: ts.Identifier; member: ts.Identifier } | undefined {
  const [namespace, member] = ts.isPropertyAccessExpression(node)
    ? [node.expression, node.name]
    : ts.isQualifiedName(node)
      ? [node.left, node.right]
      : [];

  if (!namespace || !member || !ts.isIdentifier(namespace) || !ts.isIdentifier(member)) {
    return undefined;
  }

  return namespaceAliases.has(namespace.text) ? { namespace, member } : undefined;
}

function updateImports(
  sourceFile: ts.SourceFile,
): Array<{ start: number; end: number; replacement: string; oldName: string }> {
  const replacements: Array<{ start: number; end: number; replacement: string; oldName: string }> = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/query') {
        const namedBindings = node.importClause?.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => {
            const importedName = element.propertyName?.text || element.name.text;
            const newName = TYPE_RENAMES.get(importedName) || FUNCTION_RENAMES.get(importedName);

            if (newName) {
              if (element.propertyName) {
                // Handle: import { Query as MyQuery }
                // Rename to: import { V2Query as MyQuery }
                replacements.push({
                  start: element.propertyName.getStart(sourceFile),
                  end: element.propertyName.getEnd(),
                  replacement: newName,
                  oldName: importedName,
                });
              } else {
                // Handle: import { Query }
                // Rename to: import { V2Query }
                replacements.push({
                  start: element.name.getStart(sourceFile),
                  end: element.name.getEnd(),
                  replacement: newName,
                  oldName: importedName,
                });
              }
            }
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return replacements;
}

//#endregion

//#region ExperimentalQuery namespace replacement

function replaceExperimentalQueryNamespace(tree: Tree): void {
  const updatedFiles: string[] = [];
  const removedHelpers: string[] = [];
  let totalReplacements = 0;

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    // Check if file imports ExperimentalQuery
    if (!content.includes('ExperimentalQuery')) return;

    const result = replaceNamespaceInFile(content, filePath);

    if (result.modified) {
      tree.write(filePath, result.content);
      updatedFiles.push(filePath);
      totalReplacements += result.replacementCount;
    }

    findRemovedExperimentalQueryHelpers(createSourceFile(result.content, filePath)).forEach(({ name, line }) => {
      removedHelpers.push(`   - ${filePath}:${line} ${name}: ${REMOVED_EXPERIMENTAL_QUERY_HELPERS[name]}`);
    });
  });

  if (removedHelpers.length > 0) {
    console.warn(
      `\n⚠️ These ExperimentalQuery helpers no longer exist in v3 and were left for you to replace by hand (migrate-to-query-v3 lists them again in its report):\n${removedHelpers.join('\n')}`,
    );
  }

  if (updatedFiles.length > 0) {
    console.log(
      `\n📦 Replaced ExperimentalQuery namespace in ${updatedFiles.length} files (${totalReplacements} usages)`,
    );
  }
}

function replaceNamespaceInFile(
  content: string,
  filePath: string,
): { content: string; modified: boolean; replacementCount: number } {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const usedSymbols = new Set<string>();
  let hasExperimentalQueryImport = false;
  let experimentalQueryAlias: string | undefined;

  // First pass: find ExperimentalQuery import and get the alias
  function collectImport(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/query') {
        const namedBindings = node.importClause?.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => {
            const importedName = element.propertyName?.text || element.name.text;
            if (importedName === 'ExperimentalQuery') {
              hasExperimentalQueryImport = true;
              // The local name (alias) is what we use in the code
              experimentalQueryAlias = element.name.text;
            }
          });
        }
      }
    }

    ts.forEachChild(node, collectImport);
  }

  collectImport(sourceFile);

  const namespaceAliases = collectQueryNamespaceAliases(sourceFile);
  const namespaceReplacements = collectNamespacedExperimentalQueryReplacements(sourceFile, namespaceAliases);

  // If no ExperimentalQuery import found, return unchanged
  if (!hasExperimentalQueryImport || !experimentalQueryAlias) {
    return applyReplacements(content, namespaceReplacements, namespaceReplacements.length);
  }

  // Second pass: collect used symbols
  function findUsages(node: ts.Node) {
    // Find usages: ExperimentalQuery.someSymbol or E.someSymbol (if aliased)
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === experimentalQueryAlias
    ) {
      const symbolName = node.name.text;
      usedSymbols.add(symbolName);
    }

    ts.forEachChild(node, findUsages);
  }

  findUsages(sourceFile);

  // Build the new import statement with used symbols
  const sortedSymbols = Array.from(usedSymbols).sort();

  // Third pass: create replacements
  function createReplacements(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/query') {
        const namedBindings = node.importClause?.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          // We need to update the entire import declaration
          const otherImports: string[] = [];
          let hasExperimentalQuery = false;

          namedBindings.elements.forEach((element) => {
            const importedName = element.propertyName?.text || element.name.text;
            if (importedName === 'ExperimentalQuery') {
              hasExperimentalQuery = true;
            } else {
              // Keep other imports as-is
              if (element.propertyName) {
                otherImports.push(`${element.propertyName.text} as ${element.name.text}`);
              } else {
                otherImports.push(element.name.text);
              }
            }
          });

          if (hasExperimentalQuery) {
            // Combine other imports with the expanded ExperimentalQuery symbols
            const allImports = [...otherImports, ...sortedSymbols].sort();

            let newImport: string;
            if (allImports.length === 0) {
              // No imports needed, remove the entire import
              newImport = '';
            } else if (allImports.length <= 3) {
              // Single line
              newImport = `import { ${allImports.join(', ')} } from '@ethlete/query';`;
            } else {
              // Multi-line
              newImport = `import {\n  ${allImports.join(',\n  ')}\n} from '@ethlete/query';`;
            }

            replacements.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement: newImport,
            });
          }
        }
      }
    }

    // Replace usages: ExperimentalQuery.someSymbol → someSymbol
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === experimentalQueryAlias
    ) {
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: node.name.text,
      });
    }

    ts.forEachChild(node, createReplacements);
  }

  createReplacements(sourceFile);

  // Subtract 1 for the import replacement
  return applyReplacements(
    content,
    [...replacements, ...namespaceReplacements],
    replacements.length - 1 + namespaceReplacements.length,
  );
}

function collectNamespacedExperimentalQueryReplacements(
  sourceFile: ts.SourceFile,
  namespaceAliases: Set<string>,
): Array<{ start: number; end: number; replacement: string }> {
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  if (namespaceAliases.size === 0) {
    return replacements;
  }

  function visit(node: ts.Node) {
    const access = getNamespaceMember(node, namespaceAliases);

    if (access?.member.text === 'ExperimentalQuery') {
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: access.namespace.text });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return replacements;
}

function applyReplacements(
  content: string,
  replacements: Array<{ start: number; end: number; replacement: string }>,
  replacementCount: number,
): { content: string; modified: boolean; replacementCount: number } {
  let result = content;

  [...replacements]
    .sort((a, b) => b.start - a.start)
    .forEach(({ start, end, replacement }) => {
      result = result.slice(0, start) + replacement + result.slice(end);
    });

  return { content: result, modified: replacements.length > 0, replacementCount };
}

//#endregion

//#region Prebuilt packages

type RootPackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const isRenamedSymbol = (name: string) => TYPE_RENAMES.has(name) || FUNCTION_RENAMES.has(name);

function reportPrebuiltPackagesImportingRenamedSymbols(tree: Tree): void {
  if (!tree.exists('package.json')) return;

  const packageJson = readJson<RootPackageJson>(tree, 'package.json');
  const packageNames = new Set(
    [packageJson.dependencies, packageJson.devDependencies, packageJson.optionalDependencies].flatMap((deps) =>
      Object.keys(deps ?? {}),
    ),
  );

  const hits: string[] = [];

  [...packageNames]
    .filter((name) => !name.startsWith('@ethlete/'))
    .sort()
    .forEach((packageName) => {
      const importedNames = new Set<string>();

      collectDeclarationFiles(tree, joinPathFragments('node_modules', packageName)).forEach((filePath) => {
        const content = tree.read(filePath, 'utf-8');
        if (!content?.includes('@ethlete/query')) return;

        findRenamedSymbolsInDeclaration(createSourceFile(content, filePath)).forEach((name) => importedNames.add(name));
      });

      if (importedNames.size > 0) {
        hits.push(`   - ${packageName}: ${[...importedNames].sort().join(', ')}`);
      }
    });

  if (hits.length > 0) {
    console.warn(
      `\n⚠️ These installed packages were built against @ethlete/query v2 and import names v3 no longer exports. No codemod can fix them here: run prep-for-query-v3 in each package's own repository and release a rebuild before upgrading this workspace:\n${hits.join('\n')}`,
    );
  }
}

function collectDeclarationFiles(tree: Tree, dir: string): string[] {
  if (!tree.exists(dir)) return [];

  return tree.children(dir).flatMap((child) => {
    if (child === 'node_modules') return [];

    const childPath = joinPathFragments(dir, child);

    if (tree.isFile(childPath)) {
      return /\.d\.(c|m)?ts$/.test(child) ? [childPath] : [];
    }

    return collectDeclarationFiles(tree, childPath);
  });
}

function findRenamedSymbolsInDeclaration(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const namespaceAliases = collectQueryNamespaceAliases(sourceFile);
  const isQueryModule = (node: ts.Node | undefined) =>
    !!node && ts.isStringLiteral(node) && node.text === '@ethlete/query';

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && isQueryModule(node.moduleSpecifier)) {
      const namedBindings = node.importClause?.namedBindings;

      if (namedBindings && ts.isNamedImports(namedBindings)) {
        namedBindings.elements.forEach((element) => names.add((element.propertyName ?? element.name).text));
      }
    }

    if (ts.isExportDeclaration(node) && isQueryModule(node.moduleSpecifier) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((element) => names.add((element.propertyName ?? element.name).text));
      }
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      isQueryModule(node.argument.literal) &&
      node.qualifier
    ) {
      names.add(getLeftmostIdentifier(node.qualifier).text);
    }

    const namespaceMember = getNamespaceMember(node, namespaceAliases)?.member;

    if (namespaceMember) {
      names.add(namespaceMember.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return new Set([...names].filter(isRenamedSymbol));
}

function getLeftmostIdentifier(name: ts.EntityName): ts.Identifier {
  return ts.isIdentifier(name) ? name : getLeftmostIdentifier(name.left);
}

//#endregion
