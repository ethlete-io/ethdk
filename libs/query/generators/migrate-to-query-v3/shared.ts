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

/** `toProvideFn` / `toInjectFn` - the provider-definition extractors every generated ref pair needs. */
export const ensureImportFromEthleteCore = (content: string, importsNeeded: string[]) =>
  ensureNamedImports({ content, importsNeeded, moduleSpecifier: '@ethlete/core' });

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

const MIGRATION_GUIDE_URL = 'https://ethlete-sdk-docs.web.app/query/migrating-from-v2';

/**
 * The tag every `createLegacyQueryCreator(…)` wrapper carries. The wrapper is a migration
 * scaffold, so marking it is what turns "which call sites are still on v2" from a grep into
 * strikethrough in the editor.
 */
export const legacyQueryDeprecationTag = (creatorName?: string) =>
  `@deprecated Legacy (v2) query wrapper. Migrate the call sites to ${
    creatorName ? `\`${creatorName}\`` : 'the query creator it wraps'
  } and delete this wrapper - see ${MIGRATION_GUIDE_URL}.`;

/**
 * Adds a tag to `node`'s JSDoc, creating the block when there is none. Returns `null` when the
 * tag is already there, so a caller can tell "nothing to do" from "rewritten".
 *
 * Leading `//` comments stay glued to the node - an `eslint-disable-next-line` only works from
 * the line directly above.
 */
export const addJsDocTag = (content: string, sourceFile: ts.SourceFile, node: ts.Node, tag: string) => {
  const jsDocs = (node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc ?? [];
  const existing = jsDocs[jsDocs.length - 1];

  const tagName = /^@\w+/.exec(tag)?.[0];

  if (existing && tagName && new RegExp(`${tagName}\\b`).test(existing.getText())) {
    return null;
  }

  if (existing) {
    const start = existing.getStart(sourceFile);
    const indentation = ' '.repeat(sourceFile.getLineAndCharacterOfPosition(start).character);
    const text = existing.getText();
    const body = text.slice(0, text.lastIndexOf('*/')).replace(/\s+$/, '');
    // A one-line `/** … */` has to become a block before a tag line can be appended to it.
    const opened = body.includes('\n') ? body : `/**\n${indentation} * ${body.slice(3).trim()}`;

    return (
      content.slice(0, start) +
      `${opened}\n${indentation} *\n${indentation} * ${tag}\n${indentation} */` +
      content.slice(existing.getEnd())
    );
  }

  let start = node.getStart(sourceFile, false);

  for (const comment of (ts.getLeadingCommentRanges(content, node.getFullStart()) ?? []).reverse()) {
    if (comment.kind !== ts.SyntaxKind.SingleLineCommentTrivia) break;
    if (!/^\n[ \t]*$/.test(content.slice(comment.end, start))) break;

    start = comment.pos;
  }

  const indentation = ' '.repeat(sourceFile.getLineAndCharacterOfPosition(start).character);

  return (
    content.slice(0, start) + `/**\n${indentation} * ${tag}\n${indentation} */\n${indentation}` + content.slice(start)
  );
};
