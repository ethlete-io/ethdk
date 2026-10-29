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

/** The model ids in the `madeBy` literal of a part file; none when it has no such array of strings. */
export const madeByOf = (source: string): string[] => {
  const { definition } = definitionOf(source);
  const current = definition ? propertyOf(definition, 'madeBy')?.initializer : undefined;

  if (!current || !ts.isArrayLiteralExpression(current)) return [];

  return current.elements.flatMap((element) => (ts.isStringLiteralLike(element) ? [element.text] : []));
};

/** The `note` literal of a part file's `definePart({ … })`; `null` when it holds none. */
export const noteOf = (source: string): string | null => {
  const { definition } = definitionOf(source);
  const current = definition ? propertyOf(definition, 'note')?.initializer : undefined;

  return current && (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) ? current.text : null;
};

const quoted = (text: string) => `'${text.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'").replace(/\r?\n/gu, '\\n')}'`;

/** The part file with its `note` replaced, or `null` when it holds no `definePart({ note: '…' })` literal. */
export const withNote = (source: string, note: string): string | null => {
  const { file, definition } = definitionOf(source);
  const current = definition ? propertyOf(definition, 'note')?.initializer : undefined;

  if (!current || !(ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current))) return null;

  return `${source.slice(0, current.getStart(file))}${quoted(note)}${source.slice(current.getEnd())}`;
};

const lineStartOf = (source: string, position: number) => {
  const newline = source.lastIndexOf('\n', position - 1);

  return newline === -1 ? position : newline;
};

/**
 * The part file with `madeBy` in its `definePart({ … })` set to the model ids, written next to `note`; an empty
 * list removes it. `null` when the file holds no `definePart({ note })` to write it next to.
 */
export const withMadeBy = (source: string, madeBy: string[]): string | null => {
  const { file, definition } = definitionOf(source);
  const note = definition ? propertyOf(definition, 'note') : undefined;

  if (!definition || !note) return null;

  const current = propertyOf(definition, 'madeBy');
  const value = `madeBy: [${madeBy.map(quoted).join(', ')}]`;

  if (current) {
    if (madeBy.length > 0) return `${source.slice(0, current.getStart(file))}${value}${source.slice(current.getEnd())}`;

    const end = source[current.getEnd()] === ',' ? current.getEnd() + 1 : current.getEnd();

    return `${source.slice(0, lineStartOf(source, current.getStart(file)))}${source.slice(end)}`;
  }

  if (madeBy.length === 0) return source;

  const start = note.getStart(file);
  const indent = /^\n?([ \t]*)/u.exec(source.slice(lineStartOf(source, start), start))?.[1] ?? '';

  return `${source.slice(0, note.getEnd())},\n${indent}${value}${source.slice(note.getEnd())}`;
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
