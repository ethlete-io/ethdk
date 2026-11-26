import ts from 'typescript';
import { reachableFilesOf, repoRootOf, sdkDesignFileOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf, sourceFileOf } from './ts-source';

const drawsReachedModule = (options: { part: ResolvedPart; root: string; reached: Map<string, string> }) =>
  importsOf(options.part.source).some((specifier) => {
    const file = sdkDesignFileOf(options.root, specifier);

    return file !== null && specifier.endsWith(`/${options.part.name}`) && options.reached.has(file);
  });

const propertyNameOf = (node: ts.ObjectLiteralElementLike) =>
  ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ? node.name.text
    : null;

const kebabOf = (name: string) => name.toLowerCase().replace(/_/gu, '-');

/** The part keys a source names in a `controls[*].part` and the `X_IMPORTS` names of its `ng(…, { imports })` calls. */
const namedUsesOf = (source: string) => {
  const parts = new Set<string>();
  const imports = new Set<string>();
  const visit = (node: ts.Node, inControls: boolean) => {
    if (ts.isPropertyAssignment(node) && propertyNameOf(node) === 'controls') inControls = true;

    if (inControls && ts.isPropertyAssignment(node) && propertyNameOf(node) === 'part') {
      if (ts.isStringLiteralLike(node.initializer)) parts.add(node.initializer.text);
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'ng') {
      for (const argument of node.arguments) {
        if (!ts.isObjectLiteralExpression(argument)) continue;

        for (const property of argument.properties) {
          if (propertyNameOf(property) !== 'imports' || !ts.isPropertyAssignment(property)) continue;
          if (!ts.isArrayLiteralExpression(property.initializer)) continue;

          for (const element of property.initializer.elements) {
            if (ts.isStringLiteralLike(element) && element.text.endsWith('_IMPORTS')) {
              imports.add(kebabOf(element.text.slice(0, -'_IMPORTS'.length)));
            }
          }
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, inControls));
  };

  visit(sourceFileOf(source), false);

  return { parts, imports };
};

/**
 * The keys of the base parts that no own part or token part of the product imports, directly or
 * through other parts, and whose same-named `@ethlete/<lib>/design` module none of them reaches either. A
 * `controls[*].part` ref or an `ng(…, { imports: ['X_IMPORTS'] })` name in such a part counts as use too.
 */
export const unusedBasePartsOf = (product: ResolvedProduct): Set<string> => {
  const base = product.parts.filter((part) => part.origin === 'base');

  if (base.length === 0) return new Set();

  const tokens = new Set(product.tokens);
  const roots = product.parts.filter((part) => part.origin !== 'base' || tokens.has(partKeyOf(part)));
  const { files, sdkDesign } = reachableFilesOf(product, roots);
  const named = [...files].filter(([file]) => !file.endsWith('.css')).map(([, source]) => namedUsesOf(source));
  const namedKeys = new Set(named.flatMap((uses) => [...uses.parts]));
  const namedImports = new Set(named.flatMap((uses) => [...uses.imports]));
  const root = repoRootOf(product);

  return new Set(
    base
      .filter(
        (part) =>
          !files.has(part.file) &&
          !drawsReachedModule({ part, root, reached: sdkDesign }) &&
          !namedKeys.has(partKeyOf(part)) &&
          !(part.layer === 'components' && namedImports.has(part.name)),
      )
      .map(partKeyOf),
  );
};
