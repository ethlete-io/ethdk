import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { createSourceFile, getLineNumberFromPosition } from './shared.js';

export const removeDevtoolsUsage = (tree: Tree) => {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.html')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    if (filePath.endsWith('.ts')) {
      if (!content.includes('provideQueryClientForDevtools') && !content.includes('QueryDevtoolsComponent')) {
        return;
      }

      const withoutProviders = removeProvideQueryClientForDevtools(content);
      const nextContent = removeQueryDevtoolsComponent(withoutProviders);

      if (nextContent !== content) {
        tree.write(filePath, nextContent);
        updatedFiles.push(filePath);
      }

      return;
    }

    if (!content.includes('et-query-devtools')) {
      return;
    }

    const nextContent = removeDevtoolsFromHtml(content);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n✅ Removed legacy query devtools usage in:');
    updatedFiles.forEach((filePath) => console.log(`   - ${filePath}`));
  }
};

export const replaceAnyQueryWithLegacy = (tree: Tree) => {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
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

export const migrateEmptyPrepareCalls = (tree: Tree) => {
  const updatedFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
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

const removeProvideQueryClientForDevtools = (content: string) => {
  return content
    .replace(/,?\s*provideQueryClientForDevtools\([^)]*\)/g, '')
    .replace(/\[\s*,/g, '[')
    .replace(/,\s*\]/g, ']')
    .replace(/\n\s*\n\s*\n/g, '\n\n');
};

const removeQueryDevtoolsComponent = (content: string) => {
  const withoutImportsArray = removeQueryDevtoolsImportsFromMetadata(content);

  return removeDevtoolsImports(withoutImportsArray);
};

const removeQueryDevtoolsImportsFromMetadata = (content: string) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'imports' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      const nextElements = node.initializer.elements.filter((element) => {
        return !(ts.isIdentifier(element) && element.text === 'QueryDevtoolsComponent');
      });

      if (nextElements.length === node.initializer.elements.length) {
        ts.forEachChild(node, visit);
        return;
      }

      const replacement = `imports: [${nextElements.map((element) => element.getText(sourceFile)).join(', ')}]`;

      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement,
      });
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

const removeDevtoolsImports = (content: string) => {
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

  const nextElements = importNode.importClause.namedBindings.elements.filter((element) => {
    return element.name.text !== 'QueryDevtoolsComponent' && element.name.text !== 'provideQueryClientForDevtools';
  });

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

const removeDevtoolsFromHtml = (content: string) => {
  return content
    .replace(/<et-query-devtools\s*\/>/g, '')
    .replace(/<et-query-devtools[^>]*>[\s\S]*?<\/et-query-devtools>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');
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

  const nextElements = importNode.importClause.namedBindings.elements.filter((element) => {
    return element.name.text !== 'AnyV2Query' && element.name.text !== 'AnyV2QueryCreator';
  });

  const names = nextElements.map((element) => element.getText(sourceFile));

  if (!names.includes('AnyLegacyQuery')) {
    names.push('AnyLegacyQuery');
  }

  if (!names.includes('AnyLegacyQueryCreator')) {
    names.push('AnyLegacyQueryCreator');
  }

  const nextImport = `import { ${names.sort().join(', ')} } from '@ethlete/query';`;

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
