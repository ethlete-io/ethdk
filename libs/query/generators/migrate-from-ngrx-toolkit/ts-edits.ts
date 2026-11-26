import * as ts from 'typescript';
import { pruneUnusedNamedImports } from '../migrate-to-query-v3/rename-symbols.js';
import { createSourceFile } from '../migrate-to-query-v3/shared.js';

export type TextEdit = {
  start: number;
  end: number;
  text: string;
};

/** Applies edits back to front. An edit nested inside an already applied one is dropped. */
export const applyEdits = (content: string, edits: readonly TextEdit[]) => {
  const sorted = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
  let result = content;
  let floor = Number.POSITIVE_INFINITY;

  for (const edit of sorted) {
    if (edit.end > floor) continue;

    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    floor = edit.start;
  }

  return result;
};

/** Removes `nodes[index]` from a comma separated list, together with the comma that belongs to it. */
export const removeListElement = (nodes: ts.NodeArray<ts.Node>, index: number, sourceFile: ts.SourceFile): TextEdit => {
  const node = nodes[index]!;

  if (index < nodes.length - 1) {
    return { start: node.getStart(sourceFile), end: nodes[index + 1]!.getStart(sourceFile), text: '' };
  }

  if (index > 0) {
    return { start: nodes[index - 1]!.getEnd(), end: node.getEnd(), text: '' };
  }

  return { start: node.getStart(sourceFile), end: node.getEnd(), text: '' };
};

/** Removes a whole statement or class member, including its leading comments and the line break after it. */
export const removeStatement = (node: ts.Node, content: string): TextEdit => {
  const comments = ts.getLeadingCommentRanges(content, node.getFullStart()) ?? [];
  let start = comments[0]?.pos ?? node.getStart();

  while (start > 0 && (content[start - 1] === ' ' || content[start - 1] === '\t')) start -= 1;

  let end = node.getEnd();

  while (content[end] === ' ' || content[end] === '\t') end += 1;

  if (content[end] === '\r') end += 1;
  if (content[end] === '\n') end += 1;

  return { start, end, text: '' };
};

export const lineOf = (sourceFile: ts.SourceFile, position: number) =>
  sourceFile.getLineAndCharacterOfPosition(position).line + 1;

export const collectUsedIdentifiers = (sourceFile: ts.SourceFile) => {
  const used = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;

    if (ts.isIdentifier(node)) used.add(node.text);

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return used;
};

/** Collapses runs of blank lines left behind by removed statements, outside template literals. */
export const collapseBlankLines = (content: string) => {
  const sourceFile = createSourceFile(content);
  const templates: Array<readonly [number, number]> = [];

  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      templates.push([node.getStart(sourceFile), node.getEnd()]);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return content.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, (match, offset: number) =>
    templates.some(([start, end]) => offset >= start && offset < end) ? match : '\n\n',
  );
};

/** Drops unused namespace, default and named imports. Side-effect imports stay. */
export const pruneUnusedImports = (content: string) => {
  const sourceFile = createSourceFile(content);
  const used = collectUsedIdentifiers(sourceFile);
  const edits: TextEdit[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;

    const { name, namedBindings } = statement.importClause;

    if (namedBindings && ts.isNamespaceImport(namedBindings) && !used.has(namedBindings.name.text)) {
      if (!name || !used.has(name.text)) edits.push(removeStatement(statement, content));

      continue;
    }

    if (!namedBindings && name && !used.has(name.text)) {
      edits.push(removeStatement(statement, content));
    }
  }

  return pruneUnusedNamedImports(applyEdits(content, edits));
};

/** A relative module specifier from one workspace file to another, without the `.ts` extension. */
export const relativeSpecifier = (fromFile: string, toFile: string) => {
  const fromSegments = fromFile.split('/').slice(0, -1);
  const toSegments = toFile.replace(/\.ts$/, '').split('/');

  let shared = 0;

  while (
    shared < fromSegments.length &&
    shared < toSegments.length - 1 &&
    fromSegments[shared] === toSegments[shared]
  ) {
    shared += 1;
  }

  const ups = fromSegments.length - shared;
  const rest = toSegments.slice(shared).join('/');

  return ups === 0 ? `./${rest}` : `${'../'.repeat(ups)}${rest}`;
};

export const hasExportModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

/** The names a top-level statement declares. */
export const declaredNames = (statement: ts.Statement): string[] => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) => {
      if (ts.isIdentifier(declaration.name)) return [declaration.name.text];

      if (ts.isObjectBindingPattern(declaration.name)) {
        return declaration.name.elements.flatMap((element) =>
          ts.isIdentifier(element.name) ? [element.name.text] : [],
        );
      }

      return [];
    });
  }

  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    return [statement.name.text];
  }

  return [];
};
