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

const LITERALS = [
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.ObjectLiteralExpression,
  ts.SyntaxKind.TemplateExpression,
];

const isPositiveNumber = (node: ts.Expression) => ts.isNumericLiteral(node) && Number(node.text) > 0;

/**
 * Whether the `widths` a part file writes in `definePart({ widths })` break the rule: a literal that
 * is not a non-empty list of positive numbers. A `widths` held in a variable cannot be read and passes.
 */
export const hasBadWidths = (source: string) => {
  const { definition } = definitionOf(source);
  const widths = definition ? propertyOf(definition, 'widths')?.initializer : undefined;

  if (!widths) return false;
  if (ts.isArrayLiteralExpression(widths))
    return widths.elements.length === 0 || !widths.elements.every(isPositiveNumber);

  return LITERALS.includes(widths.kind);
};

/**
 * The widths a part file writes as a literal in `definePart({ widths: [...] })`, read without running it.
 * An empty list when it has none; `null` when they are not a literal list of numbers, so they cannot be known.
 */
export const widthsOf = (source: string): number[] | null => {
  const { definition } = definitionOf(source);
  const widths = definition ? propertyOf(definition, 'widths')?.initializer : undefined;

  if (!widths) return [];
  if (!ts.isArrayLiteralExpression(widths) || !widths.elements.every(ts.isNumericLiteral)) return null;

  return widths.elements.map((element) => Number((element as ts.NumericLiteral).text));
};

/**
 * The names a part file writes as string literals in `definePart({ interactions: [...] })`, read
 * without running it. An empty list when it has none or they are not written as a literal list.
 */
export const interactionNamesOf = (source: string): string[] => {
  const { definition } = definitionOf(source);
  const interactions = definition ? propertyOf(definition, 'interactions')?.initializer : undefined;

  if (!interactions || !ts.isArrayLiteralExpression(interactions)) return [];

  return interactions.elements.flatMap((element) =>
    ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element) ? [element.text] : [],
  );
};
