import ts from 'typescript';
import { classifyImport, folderModulesOf, partsReachedFrom } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';

type Replace = { method: string; label: string; matches: (source: string) => boolean; start: number; end: number };

const REPLACE_METHODS = new Set(['replace', 'replaceAll']);

const matcherOf = (pattern: ts.Expression): Pick<Replace, 'label' | 'matches'> | null => {
  if (ts.isStringLiteral(pattern) || ts.isNoSubstitutionTemplateLiteral(pattern)) {
    const text = pattern.text;

    return { label: `'${text}'`, matches: (source) => source.includes(text) };
  }

  if (!ts.isRegularExpressionLiteral(pattern)) return null;

  const slash = pattern.text.lastIndexOf('/');

  try {
    const regex = new RegExp(pattern.text.slice(1, slash), pattern.text.slice(slash + 1).replace(/[gy]/g, ''));

    return { label: pattern.text, matches: (source) => regex.test(source) };
  } catch {
    return null;
  }
};

const DESIGN_SYSTEM = '@design-system';

const packageNamesOf = (file: ts.SourceFile) =>
  new Set(
    file.statements.filter(ts.isImportDeclaration).flatMap((declaration) => {
      const specifier = ts.isStringLiteral(declaration.moduleSpecifier) ? declaration.moduleSpecifier.text : '';
      const clause = declaration.importClause;
      const bindings = clause?.namedBindings;

      if (classifyImport(specifier).kind !== 'other' || specifier === DESIGN_SYSTEM) return [];

      return [
        ...(clause?.name ? [clause.name.text] : []),
        ...(bindings && ts.isNamespaceImport(bindings) ? [bindings.name.text] : []),
        ...(bindings && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : []),
      ];
    }),
  );

const initializersOf = (file: ts.SourceFile) => {
  const initializers = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      initializers.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };

  visit(file);

  return initializers;
};

/** Whether `node` is markup a package draws: a call or member of a package import, directly or through a local const. */
const comesFromPackage = (
  node: ts.Expression,
  context: { packages: Set<string>; initializers: Map<string, ts.Expression>; seen: Set<string> },
): boolean => {
  if (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node) || ts.isParenthesizedExpression(node))
    return comesFromPackage(node.expression, context);
  if (!ts.isIdentifier(node)) return false;
  if (context.packages.has(node.text)) return true;

  const initializer = context.initializers.get(node.text);

  if (!initializer || context.seen.has(node.text)) return false;

  return comesFromPackage(initializer, { ...context, seen: new Set([...context.seen, node.text]) });
};

const replacesOf = (source: string) => {
  const replaces: Replace[] = [];
  const file = ts.createSourceFile('part.ts', source, ts.ScriptTarget.Latest, true);
  const context = { packages: packageNamesOf(file), initializers: initializersOf(file), seen: new Set<string>() };
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      REPLACE_METHODS.has(node.expression.name.text) &&
      node.arguments[0] &&
      !comesFromPackage(node.expression.expression, context)
    ) {
      const matcher = matcherOf(node.arguments[0]);

      if (matcher && matcher.label.includes('<'))
        replaces.push({
          method: node.expression.name.text,
          start: node.arguments[0].getStart(),
          end: node.arguments[0].getEnd(),
          ...matcher,
        });
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return replaces.sort((a, b) => a.start - b.start);
};

const modulesOf = (part: ResolvedPart) => [{ file: part.file, source: part.source }, ...folderModulesOf(part)];

const withoutPatterns = (source: string) =>
  replacesOf(source)
    .reverse()
    .reduce((text, { start, end }) => text.slice(0, start) + text.slice(end), source);

/** A `.replace` or `.replaceAll` on markup that neither the part nor any part it uses draws, so it changes nothing. */
export const staleReplacesOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) => {
    const own = modulesOf(part);
    const replaces = own.flatMap((module) => replacesOf(module.source).map((replace) => ({ module, replace })));

    if (replaces.length === 0) return [];

    const used = partsReachedFrom({ product, from: part });
    const sources = [...own, ...used.flatMap(modulesOf)].map((module) => withoutPatterns(module.source));
    const scope = `${partKeyOf(part)}${used.length > 0 ? ` or the parts it uses (${used.map(partKeyOf).join(', ')})` : ''}`;

    return replaces
      .filter(({ replace }) => !sources.some((source) => replace.matches(source)))
      .map(({ module, replace }) => ({
        rule: 'STALE-REPLACE',
        file: module.file,
        message: `${replace.method}(${replace.label}) matches no markup of ${scope}, so it changes nothing`,
      }));
  });
