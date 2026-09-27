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
  reportWithArgsNullReturns(tree);
  replaceClearQueryArgs(tree);
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
  const checker = createBindingChecker(sourceFile);
  const replacements: Array<{ start: number; end: number; replacement: string; oldName: string }> = [];
  const namespaceAliases = collectQueryNamespaceAliases(sourceFile);
  const renamedImports = new Map<ts.Symbol, { oldName: string; newName: string }>();

  sourceFile.statements.forEach((statement) => {
    getQueryNamedImports(statement)?.elements.forEach((element) => {
      const newName = TYPE_RENAMES.get(element.name.text) || FUNCTION_RENAMES.get(element.name.text);
      const symbol = checker.getSymbolAtLocation(element.name);

      if (!element.propertyName && newName && symbol) {
        renamedImports.set(symbol, { oldName: element.name.text, newName });
      }
    });
  });

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

    if (ts.isIdentifier(node) && !ts.isImportSpecifier(node.parent)) {
      const symbol = resolveReferenceSymbol(checker, node);
      const rename = symbol && renamedImports.get(symbol);

      if (rename) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: ts.isShorthandPropertyAssignment(node.parent)
            ? `${rename.oldName}: ${rename.newName}`
            : rename.newName,
          oldName: rename.oldName,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const importReplacements = updateImports(sourceFile);
  replacements.push(...importReplacements);

  replacements.forEach((r) => {
    const count = symbolUsageCounts.get(r.oldName) || 0;
    symbolUsageCounts.set(r.oldName, count + 1);
  });

  let result = content;
  replacements.sort((a, b) => b.start - a.start);

  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

function createBindingChecker(sourceFile: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = { noLib: true, noResolve: true, types: [] };
  const host = ts.createCompilerHost(options);

  host.getSourceFile = (fileName) => (fileName === sourceFile.fileName ? sourceFile : undefined);
  host.fileExists = (fileName) => fileName === sourceFile.fileName;
  host.readFile = (fileName) => (fileName === sourceFile.fileName ? sourceFile.text : undefined);

  return ts.createProgram([sourceFile.fileName], options, host).getTypeChecker();
}

function resolveReferenceSymbol(checker: ts.TypeChecker, identifier: ts.Identifier): ts.Symbol | undefined {
  const parent = identifier.parent;

  if (ts.isShorthandPropertyAssignment(parent) && parent.name === identifier) {
    return checker.getShorthandAssignmentValueSymbol(parent);
  }

  if (ts.isExportSpecifier(parent)) {
    return (parent.propertyName ?? parent.name) === identifier && !parent.parent.parent.moduleSpecifier
      ? checker.getExportSpecifierLocalTargetSymbol(parent)
      : undefined;
  }

  return checker.getSymbolAtLocation(identifier);
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

  const getAliasMember = (node: ts.Node) =>
    getNamespaceMember(node, new Set([experimentalQueryAlias as string]))?.member;

  // Second pass: collect used symbols
  function findUsages(node: ts.Node) {
    // Find usages: ExperimentalQuery.someSymbol or E.someSymbol (if aliased)
    const member = getAliasMember(node);

    if (member) {
      usedSymbols.add(member.text);
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
    const member = getAliasMember(node);

    if (member) {
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: member.text,
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

//#region withArgs null returns

function reportWithArgsNullReturns(tree: Tree): void {
  const sites: string[] = [];
  const uncheckedSites: string[] = [];

  visitQueryFiles(tree, ['withArgs'], (filePath, content) => {
    const { nullLines, uncheckedLines } = findWithArgsNullReturns(createSourceFile(content, filePath));

    nullLines.forEach((line) => sites.push(`   - ${filePath}:${line}`));
    uncheckedLines.forEach((line) => uncheckedSites.push(`   - ${filePath}:${line}`));
  });

  if (sites.length > 0) {
    console.warn(
      `\n⚠️ These withArgs callbacks return null. Before v3, null kept the previous args; v3 parks the query instead (args, response and executionState become null, and polling pauses). Check each one: a null that should park the query is fine, one that relied on keeping the previous args must now return those args itself:\n${sites.join('\n')}`,
    );
  }

  if (uncheckedSites.length > 0) {
    console.warn(
      `\n⚠️ TODO: These withArgs callbacks are passed by reference from somewhere this file does not declare, so they could not be checked for a null return. Check each one by hand - v3 parks the query on null, where earlier versions kept the previous args:\n${uncheckedSites.join('\n')}`,
    );
  }
}

type CheckableFunction = ts.FunctionLikeDeclaration & { body: ts.ConciseBody };

const isCheckableFunction = (node: ts.Node | undefined): node is CheckableFunction =>
  !!node &&
  (ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node)) &&
  !!node.body;

function resolveCallbackReference(checker: ts.TypeChecker, source: ts.Expression): CheckableFunction | undefined {
  const name = ts.isPropertyAccessExpression(source) ? source.name : source;

  if (!ts.isIdentifier(name)) return undefined;

  const declaration = checker.getSymbolAtLocation(name)?.valueDeclaration;

  if (isCheckableFunction(declaration)) return declaration;

  if (!declaration || !(ts.isVariableDeclaration(declaration) || ts.isPropertyDeclaration(declaration))) {
    return undefined;
  }

  const initializer = declaration.initializer && skipOuterExpressions(declaration.initializer);

  if (isCheckableFunction(initializer)) return initializer;

  if (
    initializer &&
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === 'computed'
  ) {
    const [computation] = initializer.arguments;

    return isCheckableFunction(computation) ? computation : undefined;
  }

  return undefined;
}

function skipOuterExpressions(expression: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
    ? skipOuterExpressions(expression.expression)
    : expression;
}

function findWithArgsNullReturns(sourceFile: ts.SourceFile): { nullLines: number[]; uncheckedLines: number[] } {
  const checker = createBindingChecker(sourceFile);
  const withArgsImports = new Set<ts.Symbol>();
  const namespaceAliases = collectQueryNamespaceAliases(sourceFile);
  const nullLines: number[] = [];
  const uncheckedLines: number[] = [];
  const lineOf = (node: ts.Node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  sourceFile.statements.forEach((statement) => {
    getQueryNamedImports(statement)?.elements.forEach((element) => {
      const symbol = checker.getSymbolAtLocation(element.name);

      if ((element.propertyName ?? element.name).text === 'withArgs' && symbol) withArgsImports.add(symbol);
    });
  });

  const isWithArgsCallee = (callee: ts.Expression) => {
    if (ts.isIdentifier(callee)) {
      const symbol = checker.getSymbolAtLocation(callee);

      return !!symbol && withArgsImports.has(symbol);
    }

    return getNamespaceMember(callee, namespaceAliases)?.member.text === 'withArgs';
  };

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && isWithArgsCallee(node.expression)) {
      const [source] = node.arguments;
      const callback = source && (isCheckableFunction(source) ? source : resolveCallbackReference(checker, source));

      if (callback) {
        collectNullReturns(callback).forEach((nullNode) => nullLines.push(lineOf(nullNode)));
      } else if (source) {
        uncheckedLines.push(lineOf(source));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { nullLines: [...new Set(nullLines)].sort((a, b) => a - b), uncheckedLines };
}

function collectNullReturns(fn: CheckableFunction): ts.Node[] {
  if (!ts.isBlock(fn.body)) {
    return findNullResults(fn.body);
  }

  const found: ts.Node[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionLike(node)) return;

    if (ts.isReturnStatement(node) && node.expression) {
      found.push(...findNullResults(node.expression));
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(fn.body, visit);

  return found;
}

function findNullResults(expression: ts.Expression): ts.Node[] {
  if (expression.kind === ts.SyntaxKind.NullKeyword) return [expression];

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return findNullResults(expression.expression);
  }

  if (ts.isConditionalExpression(expression)) {
    return [...findNullResults(expression.whenTrue), ...findNullResults(expression.whenFalse)];
  }

  if (
    ts.isBinaryExpression(expression) &&
    [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(
      expression.operatorToken.kind,
    )
  ) {
    return findNullResults(expression.right);
  }

  return [];
}

//#endregion

//#region CLEAR_QUERY_ARGS replacement

const CLEAR_QUERY_ARGS_NAMES = new Set(['CLEAR_QUERY_ARGS', 'ClearQueryArgs']);

function replaceClearQueryArgs(tree: Tree): void {
  const updatedFiles: string[] = [];
  const reExports: string[] = [];

  visitQueryFiles(tree, [...CLEAR_QUERY_ARGS_NAMES], (filePath, content) => {
    const result = replaceClearQueryArgsInFile(content, filePath);

    if (result.content !== content) {
      tree.write(filePath, result.content);
      updatedFiles.push(filePath);
    }

    result.reExportLines.forEach((line) => reExports.push(`   - ${filePath}:${line}`));
  });

  if (updatedFiles.length > 0) {
    console.log(
      `\n🅿️ Replaced CLEAR_QUERY_ARGS with null (the v3 park value) in ${updatedFiles.length} files: ${updatedFiles.join(', ')}`,
    );
  }

  if (reExports.length > 0) {
    console.warn(
      `\n⚠️ These files re-exported CLEAR_QUERY_ARGS or ClearQueryArgs. They now export a local \`null\` under the same name, so their importers keep compiling. Replace each import of it with \`null\`, then delete the export:\n${reExports.join('\n')}`,
    );
  }
}

function replaceClearQueryArgsInFile(content: string, filePath: string): { content: string; reExportLines: number[] } {
  const sourceFile = createSourceFile(content, filePath);
  const checker = createBindingChecker(sourceFile);
  const namespaceAliases = collectQueryNamespaceAliases(sourceFile);
  const clearImports = new Map<ts.Symbol, string>();
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const reExportLines: number[] = [];
  const statementEnd = (statement: ts.Statement) =>
    content[statement.getEnd()] === '\n' ? statement.getEnd() + 1 : statement.getEnd();

  sourceFile.statements.forEach((statement) => {
    const namedBindings = getQueryNamedImports(statement);

    if (!namedBindings) return;

    const kept = namedBindings.elements.filter((element) => {
      const importedName = (element.propertyName ?? element.name).text;

      if (!CLEAR_QUERY_ARGS_NAMES.has(importedName)) return true;

      const symbol = checker.getSymbolAtLocation(element.name);

      if (symbol) clearImports.set(symbol, importedName);

      return false;
    });

    if (kept.length === namedBindings.elements.length) return;

    const importClause = (statement as ts.ImportDeclaration).importClause;

    if (kept.length === 0 && !importClause?.name) {
      replacements.push({ start: statement.getStart(sourceFile), end: statementEnd(statement), replacement: '' });

      return;
    }

    replacements.push({
      start: namedBindings.getStart(sourceFile),
      end: namedBindings.getEnd(),
      replacement: `{ ${kept.map((element) => element.getText(sourceFile)).join(', ')} }`,
    });
  });

  sourceFile.statements.forEach((statement) => {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
      return;
    }

    const fromQuery = isQueryModuleSpecifier(statement.moduleSpecifier);

    if (statement.moduleSpecifier && !fromQuery) return;

    const clearedName = (element: ts.ExportSpecifier) => {
      if (fromQuery) {
        const exportedName = (element.propertyName ?? element.name).text;

        return CLEAR_QUERY_ARGS_NAMES.has(exportedName) ? exportedName : undefined;
      }

      const symbol = checker.getExportSpecifierLocalTargetSymbol(element);

      return symbol && clearImports.get(symbol);
    };

    const elements = statement.exportClause.elements;
    const nullExports = elements.flatMap((element) => {
      const name = clearedName(element);

      if (!name) return [];

      return [`export ${name === 'ClearQueryArgs' ? 'type' : 'const'} ${element.name.text} = null;`];
    });

    if (nullExports.length === 0) return;

    reExportLines.push(sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1);

    const kept = elements.filter((element) => !clearedName(element));

    if (kept.length === 0) {
      replacements.push({
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        replacement: nullExports.join('\n'),
      });

      return;
    }

    replacements.push({
      start: statement.exportClause.getStart(sourceFile),
      end: statement.exportClause.getEnd(),
      replacement: `{ ${kept.map((element) => element.getText(sourceFile)).join(', ')} }`,
    });
    replacements.push({
      start: statement.getEnd(),
      end: statement.getEnd(),
      replacement: `\n${nullExports.join('\n')}`,
    });
  });

  function visit(node: ts.Node) {
    const namespaceMember = getNamespaceMember(node, namespaceAliases)?.member;
    const referencesImport = () => {
      const symbol = ts.isIdentifier(node) ? resolveReferenceSymbol(checker, node) : undefined;

      return !!symbol && clearImports.has(symbol);
    };

    if ((namespaceMember && CLEAR_QUERY_ARGS_NAMES.has(namespaceMember.text)) || referencesImport()) {
      const target = ts.isTypeQueryNode(node.parent) ? node.parent : node;
      const replacement = ts.isShorthandPropertyAssignment(node.parent) ? `${node.getText(sourceFile)}: null` : 'null';

      replacements.push({ start: target.getStart(sourceFile), end: target.getEnd(), replacement });

      return;
    }

    ts.forEachChild(node, visit);
  }

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) visit(statement);
  });

  return { content: applyReplacements(content, replacements, replacements.length).content, reExportLines };
}

function isQueryModuleSpecifier(node: ts.Node | undefined): boolean {
  return !!node && ts.isStringLiteral(node) && node.text === '@ethlete/query';
}

function visitQueryFiles(tree: Tree, markers: string[], visitor: (filePath: string, content: string) => void): void {
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content?.includes('@ethlete/query') || !markers.some((marker) => content.includes(marker))) return;

    visitor(filePath, content);
  });
}

function getQueryNamedImports(statement: ts.Statement): ts.NamedImports | undefined {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.moduleSpecifier.text !== '@ethlete/query'
  ) {
    return undefined;
  }

  const namedBindings = statement.importClause?.namedBindings;

  return namedBindings && ts.isNamedImports(namedBindings) ? namedBindings : undefined;
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
