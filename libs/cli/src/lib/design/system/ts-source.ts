import ts from 'typescript';

const PARSED_LIMIT = 512;
const parsed = new Map<string, ts.SourceFile>();

/** The syntax tree of a TS source, parsed once per text and shared by every caller, so never mutate it. */
export const sourceFileOf = (source: string): ts.SourceFile => {
  const known = parsed.get(source);

  if (known) {
    parsed.delete(source);
    parsed.set(source, known);

    return known;
  }

  const file = ts.createSourceFile('part.ts', source, ts.ScriptTarget.Latest, true);

  parsed.set(source, file);

  const oldest = parsed.size > PARSED_LIMIT ? parsed.keys().next().value : undefined;

  if (oldest !== undefined) parsed.delete(oldest);

  return file;
};

const nodesOf = (source: string) => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };

  visit(sourceFileOf(source));

  return nodes;
};

/** The module specifiers a TS file imports, static and dynamic. */
export const importsOf = (source: string) =>
  ts.preProcessFile(source, true, true).importedFiles.map((imported) => imported.fileName);

/** The text of each string literal and template chunk, so markup and inline CSS can be scanned. */
export const textsOf = (source: string) =>
  nodesOf(source).flatMap((node) =>
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
      ? [node.text]
      : [],
  );

/** The name of each function a TS file calls, `requestAnimationFrame` for `window.requestAnimationFrame(…)` too. */
export const calledNamesOf = (source: string) =>
  nodesOf(source).flatMap((node) => {
    if (!ts.isCallExpression(node)) return [];

    const callee = node.expression;

    if (ts.isIdentifier(callee)) return [callee.text];
    if (ts.isPropertyAccessExpression(callee)) return [callee.name.text];

    return [];
  });

const hasExportKeyword = (node: ts.Node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

const hasDefaultKeyword = (node: ts.Node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

const declaredNamesOf = (statement: ts.Statement): string[] => {
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  if (hasDefaultKeyword(statement)) return ['default'];
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  )
    return [statement.name.text];

  return [];
};

/** The names a TS module exports, `default` for its default export; a bare `export *` adds none. */
export const exportedNamesOf = (source: string): string[] =>
  sourceFileOf(source).statements.flatMap((statement) => {
    if (ts.isExportAssignment(statement)) return ['default'];
    if (ts.isExportDeclaration(statement))
      return statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.map((element) => element.name.text)
        : [];

    return hasExportKeyword(statement) ? declaredNamesOf(statement) : [];
  });

/**
 * The names a TS module takes from each module it imports or re-exports from, by specifier; `'*'` when it takes the
 * whole module (`import * as`, `export *`, a dynamic `import()`).
 */
export const importedNamesOf = (source: string): Map<string, Set<string>> => {
  const taken = new Map<string, Set<string>>();
  const take = (specifier: ts.Expression | undefined, names: string[]) => {
    if (!specifier || !ts.isStringLiteralLike(specifier)) return;

    const known = taken.get(specifier.text) ?? new Set<string>();

    names.forEach((name) => known.add(name));
    taken.set(specifier.text, known);
  };

  for (const node of nodesOf(source)) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;

      take(node.moduleSpecifier, [
        ...(clause?.name ? ['default'] : []),
        ...(bindings && ts.isNamespaceImport(bindings) ? ['*'] : []),
        ...(bindings && ts.isNamedImports(bindings)
          ? bindings.elements.map((element) => (element.propertyName ?? element.name).text)
          : []),
      ]);
    } else if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;

      take(
        node.moduleSpecifier,
        clause && ts.isNamedExports(clause)
          ? clause.elements.map((element) => (element.propertyName ?? element.name).text)
          : ['*'],
      );
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      take(node.arguments[0], ['*']);
    }
  }

  return taken;
};

/** The exported (not default) classes of a TS module that carry an Angular `@Component` decorator. */
export const exportedComponentClassesOf = (source: string): string[] =>
  sourceFileOf(source).statements.flatMap((statement) =>
    ts.isClassDeclaration(statement) &&
    statement.name &&
    hasExportKeyword(statement) &&
    !hasDefaultKeyword(statement) &&
    (ts.getDecorators(statement) ?? []).some(
      (decorator) =>
        ts.isCallExpression(decorator.expression) &&
        ts.isIdentifier(decorator.expression.expression) &&
        decorator.expression.expression.text === 'Component',
    )
      ? [statement.name.text]
      : [],
  );
