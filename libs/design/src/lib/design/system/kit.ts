import ts from 'typescript';
import { importsOf } from './ts-source';

export const KIT_SPECIFIER = '@design-system/kit';

export const importsKit = (source: string) => importsOf(source).includes(KIT_SPECIFIER);

const kitBindingsOf = (file: ts.SourceFile) => {
  const named = new Set<string>();
  const namespaces = new Set<string>();

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== KIT_SPECIFIER
    )
      continue;

    const bindings = statement.importClause?.namedBindings;

    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((element) => named.add(element.name.text));
  }

  return { named, namespaces };
};

/** How many calls of a wireframe kit part a part's source writes, read from the source without a render. */
export const kitUsesOf = (source: string) => {
  const file = ts.createSourceFile('part.ts', source, ts.ScriptTarget.Latest, true);
  const { named, namespaces } = kitBindingsOf(file);
  let uses = 0;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      if (ts.isIdentifier(callee) && named.has(callee.text)) uses++;
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        namespaces.has(callee.expression.text)
      )
        uses++;
    }

    ts.forEachChild(node, visit);
  };

  if (named.size > 0 || namespaces.size > 0) visit(file);

  return uses;
};
