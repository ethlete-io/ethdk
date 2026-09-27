import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScope } from './migration-scope.js';
import { ModuleGraph, createModuleGraph } from './module-graph.js';
import { isShadowedInNestedScope } from './rename-symbols.js';
import { QueryV3MigrationReport } from './report.js';
import {
  REMOVED_EXPERIMENTAL_QUERY_HELPERS,
  createSourceFile,
  ensureImportFromQuery,
  ensureNamedImports,
  findRemovedExperimentalQueryHelpers,
  getLineNumber,
  printImportDeclaration,
} from './shared.js';

export const reportRemovedExperimentalQueryHelpers = (
  tree: Tree,
  scope: MigrationScope,
  report: QueryV3MigrationReport,
) => {
  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content?.includes('@ethlete/query')) {
      return;
    }

    findRemovedExperimentalQueryHelpers(createSourceFile(content, filePath)).forEach(({ name, line }) => {
      report.addWarning({
        title: `Replace the removed helper ${name}`,
        summary: `\`${name}\` came from the pre-v3 \`ExperimentalQuery\` namespace and is no longer exported by \`@ethlete/query\`, so this import does not compile. The migration does not rewrite it.`,
        action: REMOVED_EXPERIMENTAL_QUERY_HELPERS[name]!,
        locations: [{ filePath, line }],
        source: 'cleanup-migration',
        dedupeKey: `removed-experimental-helper:${filePath}:${name}`,
      });
    });
  });
};

/**
 * Points existing devtools usage at the v3 components instead of deleting it.
 *
 * Both versions render `<et-query-devtools>`, so templates need no change at all - only the provider
 * call and the component's import move. Stripping the markup (as this phase used to) threw away
 * something that would have kept working, and left every migrated app without devtools until someone
 * noticed they were gone.
 */
export const migrateDevtoolsUsage = (tree: Tree, scope: MigrationScope, report: QueryV3MigrationReport) => {
  const updatedFiles: string[] = [];
  const filesNeedingDevtoolsPackage: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (
      !content ||
      (!content.includes('provideQueryClientForDevtools') && !content.includes('QueryDevtoolsComponent'))
    ) {
      return;
    }

    const { content: nextContent, importsComponent } = migrateDevtoolsInFile(content);

    if (nextContent === content) {
      return;
    }

    tree.write(filePath, nextContent);
    updatedFiles.push(filePath);

    if (importsComponent) {
      filesNeedingDevtoolsPackage.push(filePath);
    }
  });

  if (updatedFiles.length === 0) {
    return;
  }

  console.log('\n✅ Migrated query devtools usage to v3 in:');
  updatedFiles.forEach((filePath) => console.log(`   - ${filePath}`));

  if (filesNeedingDevtoolsPackage.length > 0) {
    // The component moved packages, which is the one part of this rewrite that can fail outside the
    // file being edited: an app that only ever depended on `@ethlete/query` now needs
    // `@ethlete/query-devtools`.
    report.addManualReview({
      title: 'Add @ethlete/query-devtools for the query devtools',
      summary:
        '`QueryDevtoolsComponent` now lives in `@ethlete/query-devtools`. The imports were rewritten, but the package may not be a dependency of these projects yet.',
      action:
        'Run `yarn add @ethlete/query-devtools` where needed, then `yarn install` and re-lint the affected libs so the `@nx/dependency-checks` rule sees the new dependency.',
      locations: filesNeedingDevtoolsPackage.map((filePath) => ({ filePath })),
      source: 'cleanup-migration',
      dedupeKey: 'devtools-package-dependency',
    });
  }
};

export const replaceAnyQueryWithLegacy = (tree: Tree, scope: MigrationScope) => {
  const updatedFiles: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    const nextContent = replaceAnyQueryInFile(content);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log(`\n✅ Replaced legacy AnyV2Query aliases in ${updatedFiles.length} files`);
  }
};

export const migrateEmptyPrepareCalls = (tree: Tree, scope: MigrationScope, report: QueryV3MigrationReport) => {
  const updatedFiles: string[] = [];
  const graph = createModuleGraph(tree);

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content || !content.includes('.prepare()')) {
      return;
    }

    const { content: nextContent, unresolved } = transformEmptyPrepareCalls(tree, graph, filePath, content);

    unresolved.forEach(({ line, receiver }) => {
      report.addManualReview({
        title: `Check the empty prepare() call on ${receiver}`,
        summary: `The migration could not tell whether \`${receiver}\` is a legacy query creator, so it left \`${receiver}.prepare()\` as is. A legacy creator needs \`.prepare({})\` in v3.`,
        action: `Change the call to \`${receiver}.prepare({})\` if \`${receiver}\` is a legacy query creator, otherwise leave it.`,
        locations: [{ filePath, line }],
        source: 'cleanup-migration',
        dedupeKey: `unresolved-empty-prepare:${filePath}:${line}`,
      });
    });

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log(`\n✅ Migrated empty .prepare() calls in ${updatedFiles.length} files`);
  }
};

type DevtoolsFileMigration = {
  content: string;

  /** Whether the file now imports `QueryDevtoolsComponent` from `@ethlete/query-devtools`. */
  importsComponent: boolean;
};

const migrateDevtoolsInFile = (content: string): DevtoolsFileMigration => {
  const componentNames = localNamesImportedFromQuery(content, 'QueryDevtoolsComponent');
  const providerNames = new Set([
    'provideQueryClientForDevtools',
    ...localNamesImportedFromQuery(content, 'provideQueryClientForDevtools'),
  ]);

  let result = replaceDevtoolsProviderCalls(content, providerNames);

  const hasProvider = result.includes('provideQueryDevtools()');

  result = dropLegacyDevtoolsImports(result);

  if (hasProvider) {
    result = ensureImportFromQuery(result, ['provideQueryDevtools']);
  }

  if (componentNames.length > 0) {
    result = ensureNamedImports({
      content: result,
      importsNeeded: componentNames.map((name) =>
        name === 'QueryDevtoolsComponent' ? name : `QueryDevtoolsComponent as ${name}`,
      ),
      moduleSpecifier: '@ethlete/query-devtools',
    });
  }

  return { content: result, importsComponent: componentNames.length > 0 };
};

const queryImports = (sourceFile: ts.SourceFile) =>
  sourceFile.statements.filter(
    (node): node is ts.ImportDeclaration =>
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query',
  );

const namedImportElements = (node: ts.ImportDeclaration) =>
  node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
    ? node.importClause.namedBindings.elements
    : [];

const importedName = (element: ts.ImportSpecifier) => (element.propertyName ?? element.name).text;

const localNamesImportedFromQuery = (content: string, name: string) =>
  queryImports(createSourceFile(content)).flatMap((node) =>
    namedImportElements(node)
      .filter((element) => importedName(element) === name)
      .map((element) => element.name.text),
  );

/**
 * Turns every `provideQueryClientForDevtools({ client, displayName })` into a single
 * `provideQueryDevtools()`.
 *
 * v3 registers every client and auth provider at once, so N per-client calls collapse to one. The
 * first call site keeps its position - it is already where the app wanted its devtools - and the
 * rest are removed along with the comma that separated them.
 */
const replaceDevtoolsProviderCalls = (content: string, providerNames: ReadonlySet<string>) => {
  const sourceFile = createSourceFile(content);
  const calls: ts.CallExpression[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && providerNames.has(node.expression.text)) {
      calls.push(node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (calls.length === 0) {
    return content;
  }

  const replacements = calls.map((call, index) => {
    const start = call.getStart(sourceFile);
    const end = call.getEnd();

    if (index === 0) {
      return { start, end, replacement: 'provideQueryDevtools()' };
    }

    return { ...withSurroundingComma(content, start, end), replacement: '' };
  });

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return result;
};

/** Widens a range to swallow the comma that separated the element from its neighbours. */
const withSurroundingComma = (content: string, start: number, end: number) => {
  let nextEnd = end;

  while (nextEnd < content.length && /\s/.test(content[nextEnd]!)) nextEnd += 1;

  if (content[nextEnd] === ',') {
    return { start, end: nextEnd + 1 };
  }

  let nextStart = start;

  while (nextStart > 0 && /\s/.test(content[nextStart - 1]!)) nextStart -= 1;

  if (content[nextStart - 1] === ',') {
    return { start: nextStart - 1, end };
  }

  return { start, end };
};

const LEGACY_DEVTOOLS_IMPORTS = new Set(['QueryDevtoolsComponent', 'provideQueryClientForDevtools']);

/** Drops the v2 devtools names from the `@ethlete/query` imports; both moved or were renamed. */
const dropLegacyDevtoolsImports = (content: string) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  for (const node of queryImports(sourceFile)) {
    const elements = namedImportElements(node);
    const nextElements = elements.filter((element) => !LEGACY_DEVTOOLS_IMPORTS.has(importedName(element)));

    if (nextElements.length === elements.length) {
      continue;
    }

    const nextImport = printImportDeclaration(
      node,
      sourceFile,
      nextElements.map((element) => element.getText(sourceFile)),
    );
    const end = !nextImport && content[node.getEnd()] === '\n' ? node.getEnd() + 1 : node.getEnd();

    replacements.push({ start: node.getStart(sourceFile), end, replacement: nextImport });
  }

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return result;
};

const replaceAnyQueryInFile = (content: string) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      if (node.text === 'AnyV2Query') {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: 'AnyLegacyQuery',
        });
      }

      if (node.text === 'AnyV2QueryCreator') {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: 'AnyLegacyQueryCreator',
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

  return result;
};

type PrepareReceiverKind = 'query' | 'foreign' | 'unknown';

const findTopLevelVariable = (sourceFile: ts.SourceFile, name: string) => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    const declaration = statement.declarationList.declarations.find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name,
    );

    if (declaration) return declaration;
  }

  return undefined;
};

const findNamedImport = (sourceFile: ts.SourceFile, localName: string) => {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const element = namedImportElements(statement).find((candidate) => candidate.name.text === localName);

    if (element) return { specifier: statement.moduleSpecifier.text, importedName: importedName(element) };
  }

  return undefined;
};

const QUERY_CLIENT_CONSTRUCTORS = new Set(['V2QueryClient', 'QueryClient']);

/**
 * Classifies what a top-level binding of `sourceFile` holds: a query creator (a call to an
 * `@ethlete/query` export such as `createLegacyQueryCreator`, or a method call on a v2 client), something
 * provably unrelated, or `unknown` when the binding cannot be followed.
 */
const classifyBinding = (
  tree: Tree,
  graph: ModuleGraph,
  filePath: string,
  sourceFile: ts.SourceFile,
  name: string,
  isClient: boolean,
  depth: number,
): PrepareReceiverKind => {
  if (depth > 4) return 'unknown';

  const declaration = findTopLevelVariable(sourceFile, name);

  if (declaration) {
    const initializer = declaration.initializer;

    if (isClient) {
      return initializer &&
        ts.isNewExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        QUERY_CLIENT_CONSTRUCTORS.has(initializer.expression.text) &&
        findNamedImport(sourceFile, initializer.expression.text)?.specifier === '@ethlete/query'
        ? 'query'
        : 'foreign';
    }

    if (!initializer || !ts.isCallExpression(initializer)) return 'foreign';

    const callee = initializer.expression;

    if (ts.isIdentifier(callee)) {
      return findNamedImport(sourceFile, callee.text)?.specifier === '@ethlete/query' ? 'query' : 'foreign';
    }

    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      return classifyBinding(tree, graph, filePath, sourceFile, callee.expression.text, true, depth + 1);
    }

    return 'foreign';
  }

  const binding = findNamedImport(sourceFile, name);

  if (!binding || binding.specifier === '@ethlete/query') return 'unknown';

  const declaringFile = graph.findDeclaringFile(filePath, binding.specifier, binding.importedName);

  if (!declaringFile) return binding.specifier.startsWith('.') ? 'unknown' : 'foreign';

  const declaringContent = tree.read(declaringFile, 'utf-8');

  if (!declaringContent) return 'unknown';

  return classifyBinding(
    tree,
    graph,
    declaringFile,
    createSourceFile(declaringContent, declaringFile),
    binding.importedName,
    isClient,
    depth + 1,
  );
};

const classifyPrepareReceiver = (
  tree: Tree,
  graph: ModuleGraph,
  filePath: string,
  sourceFile: ts.SourceFile,
  receiver: ts.Expression,
): PrepareReceiverKind => {
  if (!ts.isIdentifier(receiver) || isShadowedInNestedScope(receiver)) return 'unknown';

  return classifyBinding(tree, graph, filePath, sourceFile, receiver.text, false, 0);
};

const transformEmptyPrepareCalls = (tree: Tree, graph: ModuleGraph, filePath: string, content: string) => {
  const sourceFile = createSourceFile(content, filePath);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const unresolved: Array<{ line: number; receiver: string }> = [];
  const usesQuery = queryImports(sourceFile).length > 0;

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.name) &&
      node.expression.name.text === 'prepare' &&
      node.arguments.length === 0
    ) {
      const kind = classifyPrepareReceiver(tree, graph, filePath, sourceFile, node.expression.expression);

      if (kind === 'query') {
        replacements.push({
          start: node.arguments.pos,
          end: node.arguments.end,
          replacement: '{}',
        });
      } else if (kind === 'unknown' && usesQuery) {
        unresolved.push({
          line: getLineNumber(node, sourceFile),
          receiver: node.expression.expression.getText(sourceFile),
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

  return { content: result, unresolved };
};
