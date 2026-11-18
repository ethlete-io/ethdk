import { existsSync, readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import ts from 'typescript';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';
import { sourceFileOf, textsOf } from './ts-source';

/**
 * Who builds a part: a designer part is presentational (inputs and outputs, SDK components and parts, no services,
 * data loading or routing); any reason makes it a developer part.
 */
export type PartBuilder = { builder: 'designer' } | { builder: 'developer'; reasons: string[] };

const ROUTING_MODULES = /^@angular\/router(?:\/|$)/u;
const DATA_MODULES = /^(?:@angular\/common\/http|@ethlete\/query)(?:\/|$)/u;
const FRAMEWORK_MODULES = /^(?:@angular\/(?:core|common|cdk)(?:\/|$)|@ethlete\/)/u;
const DATA_CALLS = new Set(['fetch', 'httpResource', 'resource', 'rxResource']);
const INJECT_FUNCTION = /^inject[A-Z]/u;
const ROUTER_LINK = /\brouterLink\b/u;

const importedFromOf = (source: ts.SourceFile) => {
  const from = new Map<string, string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const module = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;

    if (bindings && ts.isNamedImports(bindings))
      bindings.elements.forEach((element) => from.set(element.name.text, module));
  }

  return from;
};

const isService = (name: string, from: Map<string, string>) => {
  const module = from.get(name);

  return module === undefined || DATA_MODULES.test(module) || !FRAMEWORK_MODULES.test(module);
};

/** Why the TS `source` of a part or component (with its `template`, if separate) is not presentational. */
export const builderReasonsOf = (options: { source: string; template?: string }): string[] => {
  const file = sourceFileOf(options.source);
  const from = importedFromOf(file);
  const reasons = new Set<string>();

  for (const [name, module] of from) {
    if (ROUTING_MODULES.test(module)) reasons.add(`routes: imports ${name} from ${module}`);
    else if (DATA_MODULES.test(module)) reasons.add(`loads data: imports ${name} from ${module}`);
  }

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      const token = node.arguments[0];

      if (callee === 'inject' && token && ts.isIdentifier(token) && isService(token.text, from))
        reasons.add(`injects the service ${token.text}`);
      else if (INJECT_FUNCTION.test(callee) && isService(callee, from)) reasons.add(`injects through ${callee}()`);
      else if (DATA_CALLS.has(callee) && (callee === 'fetch' || from.has(callee)))
        reasons.add(`loads data: calls ${callee}()`);
    }

    if (ts.isConstructorDeclaration(node))
      node.parameters.forEach((parameter) => {
        const type = parameter.type && ts.isTypeReferenceNode(parameter.type) ? parameter.type.typeName : null;

        if (type && ts.isIdentifier(type) && isService(type.text, from))
          reasons.add(`injects the service ${type.text} in its constructor`);
      });

    ts.forEachChild(node, visit);
  };

  visit(file);

  if ([...textsOf(options.source), options.template ?? ''].some((text) => ROUTER_LINK.test(text)))
    reasons.add('routes: uses routerLink');

  return [...reasons];
};

const TEMPLATE_URL = /\btemplateUrl\s*:\s*['"`]([^'"`]+)['"`]/u;

const read = (file: string) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

const componentReasonsOf = (root: string, component: string) => {
  const file = resolve(root, component);
  const source = existsSync(file) ? read(file) : null;

  if (source === null) return [];

  const templateUrl = source.match(TEMPLATE_URL)?.[1];
  const template = templateUrl ? (read(resolve(dirname(file), templateUrl)) ?? '') : '';

  return builderReasonsOf({ source, template }).map((reason) => `${reason} (${component})`);
};

/** Who builds `part`: checked on its design file before the build and on its `implements` component after it. */
export const partBuilderOf = (options: { product: ResolvedProduct; part: ResolvedPart }): PartBuilder => {
  const root = repoRootOf(options.product);
  const link = partLinkOf(options.part.source);
  const component = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
  const reasons = [
    ...builderReasonsOf({ source: options.part.source }).map(
      (reason) => `${reason} (${relative(root, options.part.file)})`,
    ),
    ...(component ? componentReasonsOf(root, component) : []),
  ];

  return reasons.length > 0 ? { builder: 'developer', reasons } : { builder: 'designer' };
};

/** One line per developer part of `product`, naming why and that a developer builds it. */
export const developerPartLinesOf = (options: { product: ResolvedProduct; parts?: string[] }) =>
  options.product.parts
    .filter((part) => part.origin !== 'base' && (!options.parts || options.parts.includes(partKeyOf(part))))
    .flatMap((part) => {
      const builder = partBuilderOf({ product: options.product, part });

      return builder.builder === 'developer'
        ? [
            `DEVELOPER ${options.product.name} ${partKeyOf(part)}: ${builder.reasons.join('; ')} - a developer builds it`,
          ]
        : [];
    });
