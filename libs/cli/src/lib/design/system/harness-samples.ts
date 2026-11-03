import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import ts from 'typescript';
import { harnessOf } from './harness-map';
import { ResolvedProduct } from './resolve-product';
import { sourceFileOf } from './ts-source';

const SAMPLES_EXPORT = 'DESIGN_HARNESS_SAMPLES';

const samplesObjectOf = (source: string) => {
  for (const statement of sourceFileOf(source).statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === SAMPLES_EXPORT &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      )
        return declaration.initializer;
  }

  return null;
};

const readPropsOf = (body: ts.Node, parameter: string) => {
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === parameter) {
      if (ts.isStringLiteralLike(node.argumentExpression)) names.push(node.argumentExpression.text);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === parameter
    )
      names.push(node.name.text);

    ts.forEachChild(node, visit);
  };

  visit(body);

  return names;
};

/**
 * The props the harness samples function of `part` consumes: the names its parameter destructures, or reads off it by
 * name, in the `DESIGN_HARNESS_SAMPLES` object a source exports.
 */
export const harnessSampledPropsOf = (options: { source: string; part: string }): string[] => {
  const samples = samplesObjectOf(options.source);
  const property = samples?.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      (ts.isStringLiteralLike(candidate.name) || ts.isIdentifier(candidate.name)) &&
      candidate.name.text === options.part,
  );
  const sample = property?.initializer;

  if (!sample || !(ts.isArrowFunction(sample) || ts.isFunctionExpression(sample))) return [];

  const parameter = sample.parameters[0]?.name;

  if (!parameter) return [];
  if (ts.isIdentifier(parameter)) return [...new Set(readPropsOf(sample.body, parameter.text))];
  if (!ts.isObjectBindingPattern(parameter)) return [];

  return parameter.elements.flatMap((element) => {
    if (element.dotDotDotToken) return [];

    const name = element.propertyName ?? element.name;

    return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? [name.text] : [];
  });
};

/** The source file beside the harness map that exports `DESIGN_HARNESS_SAMPLES`, or `null` without one. */
export const harnessSamplesFileOf = (options: { target: string; map: string }): string | null => {
  const dir = dirname(resolve(options.target, options.map));

  if (!existsSync(dir)) return null;

  const file = readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => join(dir, name))
    .find((path) => samplesObjectOf(readFileSync(path, 'utf8')) !== null);

  return file ?? null;
};

/** The props of `part` the product's harness samples consume, so compare need not find an input for them. */
export const productSampledPropsOf = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
}): string[] => {
  const harness = harnessOf(options.product);

  if (harness === null || typeof harness === 'string') return [];

  const file = harnessSamplesFileOf({ target: options.target, map: harness.map });

  return file === null ? [] : harnessSampledPropsOf({ source: readFileSync(file, 'utf8'), part: options.part });
};
