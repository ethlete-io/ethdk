import ts from 'typescript';

const definitionOf = (source: string) => {
  const file = ts.createSourceFile('part.ts', source, ts.ScriptTarget.Latest, true);
  let found: ts.ObjectLiteralExpression | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'definePart' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      found = node.arguments[0];

      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return { file, definition: found as ts.ObjectLiteralExpression | null };
};

const nameOf = (name: ts.PropertyName) =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : null;

const propertyOf = (definition: ts.ObjectLiteralExpression, name: string) =>
  definition.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && nameOf(property.name) === name,
  );

/**
 * The state names a part file declares in `definePart({ states: { … } })`, read without running it.
 * `null` when the states are not written as an object literal there, so they cannot be known.
 */
export const stateNamesOf = (source: string): string[] | null => {
  const { definition } = definitionOf(source);
  const states = definition ? propertyOf(definition, 'states')?.initializer : undefined;

  if (!states || !ts.isObjectLiteralExpression(states)) return null;

  const names = states.properties.map((property) =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && property.name
      ? nameOf(property.name)
      : null,
  );

  return names.includes(null) ? null : (names as string[]);
};

const quoted = (text: string) => `'${text.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'").replace(/\r?\n/gu, '\\n')}'`;

/** The part file with its `note` replaced, or `null` when it holds no `definePart({ note: '…' })` literal. */
export const withNote = (source: string, note: string): string | null => {
  const { file, definition } = definitionOf(source);
  const current = definition ? propertyOf(definition, 'note')?.initializer : undefined;

  if (!current || !(ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current))) return null;

  return `${source.slice(0, current.getStart(file))}${quoted(note)}${source.slice(current.getEnd())}`;
};
