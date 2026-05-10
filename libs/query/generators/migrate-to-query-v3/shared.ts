import * as ts from 'typescript';

const TEMP_SOURCE_FILE = 'temp.ts';

type EnsureNamedImportsOptions = {
  content: string;
  importsNeeded: string[];
  moduleSpecifier: string;
};

export const createSourceFile = (content: string, filePath = TEMP_SOURCE_FILE) =>
  ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

export const capitalizeFirstLetter = (value: string) => {
  if (value.length === 0) {
    return value;
  }

  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
};

export const ensureConfigSuffix = (name: string) => {
  if (/Config$/i.test(name)) {
    return name;
  }

  return `${name}Config`;
};

export const ensureNamedImports = ({ content, importsNeeded, moduleSpecifier }: EnsureNamedImportsOptions) => {
  const sourceFile = createSourceFile(content);

  let importNode: ts.ImportDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === moduleSpecifier
    ) {
      importNode = node;
    }
  });

  const missingImports = new Set<string>(importsNeeded);

  if (importNode?.importClause?.namedBindings && ts.isNamedImports(importNode.importClause.namedBindings)) {
    const namedBindings = importNode.importClause.namedBindings;

    namedBindings.elements.forEach((element) => {
      missingImports.delete(element.name.text);
    });

    if (missingImports.size === 0) {
      return content;
    }

    const existingImports = namedBindings.elements.map((element) => element.getText(sourceFile));
    const nextImports = [...existingImports, ...Array.from(missingImports).sort()].sort();
    const nextImportStatement = `import { ${nextImports.join(', ')} } from '${moduleSpecifier}';`;

    return content.slice(0, importNode.getStart(sourceFile)) + nextImportStatement + content.slice(importNode.getEnd());
  }

  let lastImportEnd = 0;

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node)) {
      return;
    }

    const end = node.getEnd();

    if (end > lastImportEnd) {
      lastImportEnd = end;
    }
  });

  const nextImportStatement = `\nimport { ${Array.from(missingImports).sort().join(', ')} } from '${moduleSpecifier}';`;

  if (lastImportEnd > 0) {
    return content.slice(0, lastImportEnd) + nextImportStatement + content.slice(lastImportEnd);
  }

  return `import { ${Array.from(missingImports).sort().join(', ')} } from '${moduleSpecifier}';\n\n${content}`;
};

export const ensureImportFromQuery = (content: string, importsNeeded: string[]) =>
  ensureNamedImports({ content, importsNeeded, moduleSpecifier: '@ethlete/query' });

export const ensureAngularCoreImports = (content: string, importsNeeded: string[]) =>
  ensureNamedImports({ content, importsNeeded, moduleSpecifier: '@angular/core' });

export const getVariableStatementEnd = (sourceFile: ts.SourceFile, variableName: string, initializerName: string) => {
  let variableStatementEnd: number | undefined;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === initializerName
    ) {
      let parent: ts.Node | undefined = node.parent;

      while (parent && !ts.isVariableStatement(parent)) {
        parent = parent.parent;
      }

      if (parent && ts.isVariableStatement(parent)) {
        variableStatementEnd = parent.getEnd();
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return variableStatementEnd;
};

export const getIndentation = (content: string, position: number) => {
  let lineStart = position;

  while (lineStart > 0 && content[lineStart - 1] !== '\n') {
    lineStart -= 1;
  }

  let indentation = '';

  for (let index = lineStart; index < position && /\s/.test(content[index]!); index += 1) {
    indentation += content[index];
  }

  return indentation || '  ';
};

export const getLineNumber = (node: ts.Node, sourceFile: ts.SourceFile) => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return line + 1;
};

export const getLineNumberFromPosition = (content: string, position: number) =>
  content.slice(0, position).split('\n').length;
