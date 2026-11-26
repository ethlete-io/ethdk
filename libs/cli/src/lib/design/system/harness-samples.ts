import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import ts from 'typescript';
import { harnessOf } from './harness-map';
import { ResolvedProduct } from './resolve-product';
import { sourceFileOf } from './ts-source';

const SAMPLES_EXPORT = 'DESIGN_HARNESS_SAMPLES';
const TEMPLATES_EXPORT = 'DESIGN_HARNESS_TEMPLATES';

const exportedObjectOf = (source: string, exportName: string) => {
  for (const statement of sourceFileOf(source).statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations)
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      )
        return declaration.initializer;
  }

  return null;
};

const samplesObjectOf = (source: string) => exportedObjectOf(source, SAMPLES_EXPORT);

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

const derivedPropsOf = (body: ts.Node, reads: (node: ts.Node) => boolean) => {
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))) {
      let read = false;
      const find = (inner: ts.Node) => {
        if (reads(inner)) read = true;

        ts.forEachChild(inner, find);
      };

      find(node.initializer);

      if (read) names.push(node.name.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(body);

  return names;
};

/**
 * The props the harness samples function of `part` consumes: the names its parameter destructures, or reads off it by
 * name, in the `DESIGN_HARNESS_SAMPLES` object a source exports, and each prop it derives from them (`variant:
 * kind === 'a' ? 'x' : 'y'`).
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
  if (ts.isIdentifier(parameter)) {
    const text = parameter.text;
    const derived = derivedPropsOf(sample.body, (node) => readPropsOf(node, text).length > 0);

    return [...new Set([...readPropsOf(sample.body, text), ...derived])];
  }
  if (!ts.isObjectBindingPattern(parameter)) return [];

  const locals = new Set(
    parameter.elements.flatMap((element) =>
      !element.dotDotDotToken && ts.isIdentifier(element.name) ? [element.name.text] : [],
    ),
  );
  const destructured = parameter.elements.flatMap((element) => {
    if (element.dotDotDotToken) return [];

    const name = element.propertyName ?? element.name;

    return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? [name.text] : [];
  });
  const derived = derivedPropsOf(sample.body, (node) => ts.isIdentifier(node) && locals.has(node.text));

  return [...new Set([...destructured, ...derived])];
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

const nameOf = (name: ts.PropertyName) => (ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null);

const templateKeysOfClass = (source: string, className: string) => {
  const keys: string[] = [];

  for (const statement of sourceFileOf(source).statements) {
    if (!ts.isClassDeclaration(statement) || statement.name?.text !== className) continue;

    const method = statement.members.find(
      (member): member is ts.MethodDeclaration =>
        ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === 'templates',
    );
    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression))
        for (const property of node.expression.properties) {
          const name = property.name ? nameOf(property.name) : null;

          if (name !== null) keys.push(name);
        }

      ts.forEachChild(node, visit);
    };

    if (method?.body) visit(method.body);
  }

  return keys;
};

/**
 * The props the harness feeds `part` itself: the keys `templates()` returns on the component the
 * `DESIGN_HARNESS_TEMPLATES` object of `source` names for it, found by class name in `sources`.
 */
export const harnessFedPropsOf = (options: { source: string; sources: readonly string[]; part: string }): string[] => {
  const templates = exportedObjectOf(options.source, TEMPLATES_EXPORT);
  const property = templates?.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && nameOf(candidate.name) === options.part,
  );

  if (!property || !ts.isIdentifier(property.initializer)) return [];

  const className = property.initializer.text;

  return [...new Set([options.source, ...options.sources].flatMap((text) => templateKeysOfClass(text, className)))];
};

/** The props of `part` the product's harness feeds through `DESIGN_HARNESS_TEMPLATES`, so no app template has to. */
export const productFedPropsOf = (options: { target: string; product: ResolvedProduct; part: string }): string[] => {
  const harness = harnessOf(options.product);

  if (harness === null || typeof harness === 'string') return [];

  const file = harnessSamplesFileOf({ target: options.target, map: harness.map });

  if (file === null) return [];

  const dir = dirname(file);
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => readFileSync(join(dir, name), 'utf8'));

  return harnessFedPropsOf({ source: readFileSync(file, 'utf8'), sources, part: options.part });
};
