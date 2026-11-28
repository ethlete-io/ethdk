import { readFileSync } from 'fs';
import ts from 'typescript';
import { Problem } from '../problem';
import { isLibraryProduct } from '../library-product';
import { ResolvedProduct } from '../resolve-product';
import { perSource, sourceFileOf } from '../ts-source';

export const SAMPLE_TEXT_RULE = 'SAMPLE-TEXT';

const GAP = '\u0000';
const TAG = /<[^>]*>/gu;
const ENTITY = /&[#\w]+;/gu;
const CLASS_TOKEN = /^[a-z0-9:_\-[\]()/.%#,=!&*>+~@]+$/u;
const IDENTIFIER = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/u;

type Literal = { text: string; line: number };

const piecesOf = (node: ts.Node): string[] | null => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];

  return null;
};

/** The runs of text a literal shows: markup tags and entities dropped, each interpolation a break. */
const textRunsOf = (pieces: string[]) =>
  pieces
    .join(GAP)
    .replace(TAG, GAP)
    .replace(ENTITY, ' ')
    .split(GAP)
    .map((run) => run.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);

const isText = (run: string) =>
  /\p{L}/u.test(run) &&
  (/\s/u.test(run) || /\p{Lu}/u.test(run)) &&
  !IDENTIFIER.test(run) &&
  !run.split(' ').every((token) => CLASS_TOKEN.test(token));

const topLevelOf = (file: ts.SourceFile) => {
  const declared = new Map<string, ts.Expression>();

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer) continue;

      const names = ts.isIdentifier(declaration.name)
        ? [declaration.name.text]
        : declaration.name.elements.flatMap((element) =>
            ts.isBindingElement(element) && ts.isIdentifier(element.name) ? [element.name.text] : [],
          );

      for (const name of names) declared.set(name, declaration.initializer);
    }
  }

  return declared;
};

const statesOf = (file: ts.SourceFile): ts.Node | null => {
  let found: ts.Node | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'definePart' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const property of node.arguments[0].properties)
        if (property.name && ts.isIdentifier(property.name) && property.name.text === 'states')
          found = ts.isPropertyAssignment(property) ? property.initializer : property.name;

      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return found;
};

const isReference = (node: ts.Identifier) => {
  const parent = node.parent;

  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;

  return !(ts.isPropertySignature(parent) || ts.isBindingElement(parent) || ts.isParameter(parent));
};

/** Each run of text the states of a part file carry, following the module constants they name. */
export const stateTextsOf = perSource((source): Literal[] => {
  const file = sourceFileOf(source);
  const states = statesOf(file);

  if (!states) return [];

  const declared = topLevelOf(file);
  const followed = new Set<string>();
  const found: Literal[] = [];
  const visit = (node: ts.Node) => {
    const pieces = piecesOf(node);

    if (pieces) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

      for (const text of textRunsOf(pieces).filter(isText)) found.push({ text, line });
    }

    if (ts.isIdentifier(node) && isReference(node) && !followed.has(node.text)) {
      const initializer = declared.get(node.text);

      followed.add(node.text);
      if (initializer) visit(initializer);
    }

    ts.forEachChild(node, visit);
  };

  visit(states);

  return found;
});

const fixtureTextsOf = (product: ResolvedProduct) => {
  if (!product.fixtures) return new Set<string>();

  const texts = new Set<string>();
  const visit = (node: ts.Node) => {
    const pieces = piecesOf(node);

    if (pieces) textRunsOf(pieces).forEach((text) => texts.add(text));
    ts.forEachChild(node, visit);
  };

  visit(sourceFileOf(readFileSync(product.fixtures, 'utf8')));

  return texts;
};

/**
 * Each run of text a part's states carry as a literal of its own file instead of taking it from the product's sample
 * data, `fixtures.ts` (`SAMPLE-TEXT`); a library product has none. A run counts as text when it holds a capital or a space and is neither a class list nor a camelCase name.
 */
export const sampleTextsOf = (product: ResolvedProduct): Problem[] => {
  if (isLibraryProduct(product)) return [];

  const fixtures = fixtureTextsOf(product);

  return product.parts
    .filter((part) => part.origin !== 'base' && part.layer !== 'foundations')
    .flatMap((part) =>
      stateTextsOf(part.source)
        .filter(({ text }) => !fixtures.has(text))
        .map(({ text }) => {
          const quoted = `"${text.length > 48 ? `${text.slice(0, 47)}…` : text}"`;

          return {
            rule: SAMPLE_TEXT_RULE,
            file: part.file,
            at: quoted,
            message: `${quoted} is sample text outside the product's sample data - put it in fixtures.ts and import it from @system/fixtures`,
          };
        }),
    );
};
