import ts from 'typescript';

const sourceFileOf = (source: string) => ts.createSourceFile('part.ts', source, ts.ScriptTarget.Latest, true);

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
