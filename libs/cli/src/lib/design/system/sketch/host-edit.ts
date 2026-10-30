import ts from 'typescript';
import { classifyImport } from '../imports';
import { partKeyOf } from '../resolve-product';
import { importsOf } from '../ts-source';

const IMPORTED = '\u0000';

const importedBindingsOf = (source: ts.SourceFile) =>
  new Set(
    source.statements.filter(ts.isImportDeclaration).flatMap((declaration) => {
      const clause = declaration.importClause;
      const bindings = clause?.namedBindings;

      return [
        ...(clause?.name ? [clause.name.text] : []),
        ...(bindings && ts.isNamespaceImport(bindings) ? [bindings.name.text] : []),
        ...(bindings && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : []),
      ];
    }),
  );

const rootOf = (node: ts.Expression): ts.Expression =>
  ts.isPropertyAccessExpression(node) ? rootOf(node.expression) : node;

const tokensOf = (text: string) => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const tokens: string[] = [];

  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan())
    tokens.push(scanner.getTokenText());

  return tokens;
};

/** The source without its import declarations, each use of an imported name (with its member access) as one token. */
const bodyOf = (text: string) => {
  const source = ts.createSourceFile('part.ts', text, ts.ScriptTarget.Latest, true);
  const imported = importedBindingsOf(source);
  const ranges: { start: number; end: number; with: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      ranges.push({ start: node.getStart(source), end: node.end, with: ' ' });

      return;
    }

    const root = ts.isPropertyAccessExpression(node) || ts.isIdentifier(node) ? rootOf(node) : null;

    if (
      root &&
      ts.isIdentifier(root) &&
      imported.has(root.text) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    ) {
      ranges.push({ start: node.getStart(source), end: node.end, with: ` ${IMPORTED} ` });

      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  const sorted = ranges.sort((a, b) => a.start - b.start);
  let body = '';
  let at = 0;

  for (const range of sorted) {
    body += `${text.slice(at, range.start)}${range.with}`;
    at = range.end;
  }

  return tokensOf(body + text.slice(at)).join(' ');
};

/** Whether `after` differs from `before` only in what it imports and how it spells the imported names it uses. */
export const changesOnlyImports = (before: string, after: string) => bodyOf(before) === bodyOf(after);

/** Whether a part source imports one of `targets` (`<layer>/<name>` keys). */
export const importsAnyOf = (source: string, targets: string[]) =>
  importsOf(source)
    .map(classifyImport)
    .some((imported) => imported.kind === 'part' && targets.includes(partKeyOf(imported)));
