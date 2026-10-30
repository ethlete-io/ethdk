import * as ts from 'typescript';

const MESSAGE =
  'reads an observable made by toObservable(), which emits only after its first effect run. Read the signal directly or use computed().';

export function findSyncObservableConsumers(filePath: string, originalContent: string, content: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const isAddedToObservable = (node: ts.Node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'toObservable' &&
    !originalContent.includes(node.getText());

  const containsAddedToObservable = (node: ts.Node): boolean =>
    isAddedToObservable(node) || (ts.forEachChild(node, containsAddedToObservable) ?? false);

  const asyncNames = new Set<string>();
  const collectNames = (node: ts.Node) => {
    if (
      (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      containsAddedToObservable(node.initializer)
    ) {
      asyncNames.add(node.name.text);
    }
    ts.forEachChild(node, collectNames);
  };
  collectNames(sourceFile);

  const isAsyncSource = (expression: ts.Expression): boolean => {
    let root = expression;
    while (ts.isCallExpression(root) && ts.isPropertyAccessExpression(root.expression)) {
      root = root.expression.expression;
    }
    if (isAddedToObservable(root)) return true;
    if (ts.isIdentifier(root)) return asyncNames.has(root.text);
    return ts.isPropertyAccessExpression(root) && root.expression.kind === ts.SyntaxKind.ThisKeyword
      ? asyncNames.has(root.name.text)
      : false;
  };

  const findings: { node: ts.Node; label: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const [source, options] = node.arguments;
      const name = node.expression.text;

      if (name === 'toSignal' && source && options && requiresSync(options) && isAsyncSource(source)) {
        findings.push({ node, label: `toSignal(${flatText(source)}, { requireSync: true })` });
      }

      if (name === 'withLatestFrom') {
        for (const argument of node.arguments.filter(isAsyncSource)) {
          findings.push({ node: argument, label: `withLatestFrom(${flatText(argument)})` });
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'pipe' &&
      isAsyncSource(node.expression.expression)
    ) {
      for (const operator of node.arguments.filter(isFirstValueOperator)) {
        findings.push({ node: operator, label: flatText(operator) });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return findings
    .sort((a, b) => a.node.getStart() - b.node.getStart())
    .map(({ node, label }) => {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      return `${filePath}:${line}: ${label} ${MESSAGE}`;
    });
}

function requiresSync(options: ts.Expression): boolean {
  return (
    ts.isObjectLiteralExpression(options) &&
    options.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText() === 'requireSync' &&
        property.initializer.kind === ts.SyntaxKind.TrueKeyword,
    )
  );
}

function isFirstValueOperator(operator: ts.Expression): boolean {
  if (!ts.isCallExpression(operator) || !ts.isIdentifier(operator.expression)) return false;
  const name = operator.expression.text;
  return name === 'first' || (name === 'take' && operator.arguments[0]?.getText() === '1');
}

function flatText(node: ts.Node): string {
  return node.getText().replace(/\s+/g, ' ');
}
