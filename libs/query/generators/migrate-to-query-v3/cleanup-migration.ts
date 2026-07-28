import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScope } from './migration-scope.js';
import { QueryV3MigrationReport } from './report.js';
import { createSourceFile, ensureImportFromQuery, ensureNamedImports, getLineNumberFromPosition } from './shared.js';

/**
 * Points existing devtools usage at the v3 components instead of deleting it.
 *
 * Both versions render `<et-query-devtools>`, so templates need no change at all — only the provider
 * call and the component's import move. Stripping the markup (as this phase used to) threw away
 * something that would have kept working, and left every migrated app without devtools until someone
 * noticed they were gone.
 */
export const migrateDevtoolsUsage = (tree: Tree, scope: MigrationScope, report: QueryV3MigrationReport) => {
  const updatedFiles: string[] = [];
  const filesNeedingComponentsPackage: string[] = [];

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
      filesNeedingComponentsPackage.push(filePath);
    }
  });

  if (updatedFiles.length === 0) {
    return;
  }

  console.log('\n✅ Migrated query devtools usage to v3 in:');
  updatedFiles.forEach((filePath) => console.log(`   - ${filePath}`));

  if (filesNeedingComponentsPackage.length > 0) {
    // The component moved packages, which is the one part of this rewrite that can fail outside the
    // file being edited: an app that only ever depended on `@ethlete/query` now needs `@ethlete/components`.
    report.addManualReview({
      title: 'Add @ethlete/components for the query devtools',
      summary:
        '`QueryDevtoolsComponent` now lives in `@ethlete/components`. The imports were rewritten, but the package may not be a dependency of these projects yet.',
      action:
        'Run `yarn add @ethlete/components` where needed, then `yarn install` and re-lint the affected libs so the `@nx/dependency-checks` rule sees the new dependency.',
      locations: filesNeedingComponentsPackage.map((filePath) => ({ filePath })),
      source: 'cleanup-migration',
      dedupeKey: 'devtools-components-dependency',
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

export const migrateEmptyPrepareCalls = (tree: Tree, scope: MigrationScope) => {
  const updatedFiles: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content || !content.includes('.prepare()')) {
      return;
    }

    const nextContent = transformEmptyPrepareCalls(content);

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

  /** Whether the file now imports `QueryDevtoolsComponent` from `@ethlete/components`. */
  importsComponent: boolean;
};

const migrateDevtoolsInFile = (content: string): DevtoolsFileMigration => {
  const importsComponent = importsFromQuery(content, 'QueryDevtoolsComponent');

  let result = replaceDevtoolsProviderCalls(content);

  const hasProvider = result.includes('provideQueryDevtools()');

  result = dropLegacyDevtoolsImports(result);

  if (hasProvider) {
    result = ensureImportFromQuery(result, ['provideQueryDevtools']);
  }

  if (importsComponent) {
    result = ensureNamedImports({
      content: result,
      importsNeeded: ['QueryDevtoolsComponent'],
      moduleSpecifier: '@ethlete/components',
    });
  }

  return { content: result, importsComponent };
};

const importsFromQuery = (content: string, name: string) => {
  const sourceFile = createSourceFile(content);

  return sourceFile.statements.some(
    (node) =>
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query' &&
      !!node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some((element) => element.name.text === name),
  );
};

/**
 * Turns every `provideQueryClientForDevtools({ client, displayName })` into a single
 * `provideQueryDevtools()`.
 *
 * v3 registers every client and auth provider at once, so N per-client calls collapse to one. The
 * first call site keeps its position — it is already where the app wanted its devtools — and the
 * rest are removed along with the comma that separated them.
 */
const replaceDevtoolsProviderCalls = (content: string) => {
  const sourceFile = createSourceFile(content);
  const calls: ts.CallExpression[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'provideQueryClientForDevtools'
    ) {
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

/** Drops the v2 devtools names from the `@ethlete/query` import; both moved or were renamed. */
const dropLegacyDevtoolsImports = (content: string) => {
  const sourceFile = createSourceFile(content);
  let importNode: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query'
    ) {
      importNode = node;
    }
  });

  if (!importNode?.importClause?.namedBindings || !ts.isNamedImports(importNode.importClause.namedBindings)) {
    return content;
  }

  const nextElements = importNode.importClause.namedBindings.elements.filter(
    (element) =>
      element.name.text !== 'QueryDevtoolsComponent' && element.name.text !== 'provideQueryClientForDevtools',
  );

  if (nextElements.length === importNode.importClause.namedBindings.elements.length) {
    return content;
  }

  if (nextElements.length === 0) {
    const nextLineEnd = content[importNode.getEnd()] === '\n' ? importNode.getEnd() + 1 : importNode.getEnd();

    return content.slice(0, importNode.getStart(sourceFile)) + content.slice(nextLineEnd);
  }

  const nextImport = `import { ${nextElements.map((element) => element.getText(sourceFile)).join(', ')} } from '@ethlete/query';`;

  return content.slice(0, importNode.getStart(sourceFile)) + nextImport + content.slice(importNode.getEnd());
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

  return removeAnyQueryFromImports(result);
};

const removeAnyQueryFromImports = (content: string) => {
  const sourceFile = createSourceFile(content);
  let importNode: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === '@ethlete/query'
    ) {
      importNode = node;
    }
  });

  if (!importNode?.importClause?.namedBindings || !ts.isNamedImports(importNode.importClause.namedBindings)) {
    return content;
  }

  const replaced = new Map([
    ['AnyV2Query', 'AnyLegacyQuery'],
    ['AnyV2QueryCreator', 'AnyLegacyQueryCreator'],
  ]);

  const names = new Set<string>();
  let changed = false;

  importNode.importClause.namedBindings.elements.forEach((element) => {
    const replacement = replaced.get(element.name.text);

    if (!replacement) {
      names.add(element.getText(sourceFile));

      return;
    }

    // Only add the alias that was actually imported. Adding both unconditionally is what put
    // `AnyLegacyQuery` / `AnyLegacyQueryCreator` into hundreds of files that never referenced them.
    changed = true;
    names.add(replacement);
  });

  if (!changed) {
    return content;
  }

  const nextImport = `import { ${Array.from(names).sort().join(', ')} } from '@ethlete/query';`;

  return content.slice(0, importNode.getStart(sourceFile)) + nextImport + content.slice(importNode.getEnd());
};

const transformEmptyPrepareCalls = (content: string) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propertyAccess = node.expression;

      if (
        ts.isIdentifier(propertyAccess.name) &&
        propertyAccess.name.text === 'prepare' &&
        node.arguments.length === 0
      ) {
        const callText = content.slice(node.getStart(sourceFile), node.getEnd());

        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: callText.replace(/\.prepare\(\)/, '.prepare({})'),
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

export const describeTemplateLine = (content: string, position: number, suffix: string) => {
  const lineNumber = getLineNumberFromPosition(content, position);

  return `${lineNumber} (${suffix})`;
};
