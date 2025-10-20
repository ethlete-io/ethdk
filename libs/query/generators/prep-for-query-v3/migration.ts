import { Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

/**
 * This migration updates symbol names that conflict with new Query v3 names.
 *
 * The following symbols are renamed to avoid naming conflicts:
 *
 * ## Types & Interfaces
 * - `BearerAuthProvider` → `V2BearerAuthProvider`
 * - `AnyQueryCreator` → `AnyV2QueryCreator`
 * - `CacheAdapterFn` → `V2CacheAdapterFn`
 * - `Query` → `V2Query`
 * - `QueryArgsOf` → `V2QueryArgsOf`
 * - `QueryClient` → `V2QueryClient`
 * - `QueryClientConfig` → `V2QueryClientConfig`
 * - `QueryConfig` → `V2QueryConfig`
 * - `QueryCreator` → `V2QueryCreator`
 * - `QueryState` → `V2QueryState`
 * - `RouteType` → `V2RouteType`
 * - `RouteString` → `V2RouteString`
 * - `AnyQuery` → `AnyV2Query`
 *
 * ## Functions
 * - `buildQueryCacheKey()` → `v2BuildQueryCacheKey()`
 * - `extractExpiresInSeconds()` → `v2ExtractExpiresInSeconds()`
 * - `shouldCacheQuery()` → `v2ShouldCacheQuery()`
 * - `shouldRetryRequest()` → `v2ShouldRetryRequest()`
 *
 * This migration also checks for usage of the ExperimentalQuery namespace import and replaces it with direct imports
 */

//#region Migration main

interface MigrationSchema {
  skipFormat?: boolean;
}

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Starting Query v3 symbol conflict migration...');

  renameConflictingSymbols(tree);
  replaceExperimentalQueryNamespace(tree);

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

    const hasRenames = Array.from(symbolUsageCounts.entries()).filter(([_, count]) => count > 0);

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

  function visit(node: ts.Node) {
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
      if (ts.isImportSpecifier(parent) && (parent.propertyName === node || parent.name === node)) {
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
  const importReplacements = updateImports(sourceFile, content);
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

function updateImports(
  sourceFile: ts.SourceFile,
  content: string,
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
  });

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

  // If no ExperimentalQuery import found, return unchanged
  if (!hasExperimentalQueryImport || !experimentalQueryAlias) {
    return { content, modified: false, replacementCount: 0 };
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

  // Apply replacements in reverse order
  let result = content;
  replacements.sort((a, b) => b.start - a.start);

  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return {
    content: result,
    modified: replacements.length > 0,
    replacementCount: replacements.length - 1, // Subtract 1 for the import replacement
  };
}

//#endregion
