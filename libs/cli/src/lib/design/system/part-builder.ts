import { existsSync, readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import ts from 'typescript';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';
import { perSource, sourceFileOf, textsOf } from './ts-source';

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
const LOADS_DATA = 'loads data';
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

const ROUTER_LINK_REASON = 'routes: uses routerLink';

const injectionOf = (call: ts.CallExpression, from: Map<string, string>) => {
  if (!ts.isIdentifier(call.expression)) return null;

  const callee = call.expression.text;
  const token = call.arguments[0];

  if (callee === 'inject' && token && ts.isIdentifier(token) && isService(token.text, from))
    return `injects the service ${token.text}`;

  return INJECT_FUNCTION.test(callee) && isService(callee, from) ? `injects through ${callee}()` : null;
};

const sourceReasonsOf = perSource((source): string[] => {
  const file = sourceFileOf(source);
  const from = importedFromOf(file);
  const reasons = new Set<string>();

  for (const [name, module] of from) {
    if (ROUTING_MODULES.test(module)) reasons.add(`routes: imports ${name} from ${module}`);
    else if (DATA_MODULES.test(module)) reasons.add(`${LOADS_DATA}: imports ${name} from ${module}`);
  }

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      const injection = injectionOf(node, from);

      if (injection) reasons.add(injection);
      else if (DATA_CALLS.has(callee) && (callee === 'fetch' || from.has(callee)))
        reasons.add(`${LOADS_DATA}: calls ${callee}()`);
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

  if (textsOf(source).some((text) => ROUTER_LINK.test(text))) reasons.add(ROUTER_LINK_REASON);

  return [...reasons];
});

/** Why the TS `source` of a part or component (with its `template`, if separate) is not presentational. */
export const builderReasonsOf = (options: { source: string; template?: string }): string[] => {
  const reasons = sourceReasonsOf(options.source);

  return ROUTER_LINK.test(options.template ?? '') && !reasons.includes(ROUTER_LINK_REASON)
    ? [...reasons, ROUTER_LINK_REASON]
    : reasons;
};

const TEMPLATE_URL = /\btemplateUrl\s*:\s*['"`]([^'"`]+)['"`]/u;

const read = (file: string) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

const RELATIVE_MODULE = /^\.\.?\//u;

const readModule = (base: string) =>
  [`${base}.ts`, `${base}/index.ts`].map((file) => (existsSync(file) ? read(file) : null)).find((found) => found) ??
  null;

const functionOf = (file: ts.SourceFile, name: string): ts.Node | null => {
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement.body ?? null;
    if (!ts.isVariableStatement(statement)) continue;

    const declared = statement.declarationList.declarations.find(
      (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name,
    );
    const initializer = declared?.initializer;

    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) return initializer;
  }

  return null;
};

const injectionsIn = (node: ts.Node, from: Map<string, string>) => {
  const found = new Set<string>();
  const visit = (child: ts.Node) => {
    const injection = ts.isCallExpression(child) ? injectionOf(child, from) : null;

    if (injection) found.add(injection);

    ts.forEachChild(child, visit);
  };

  visit(node);

  return [...found];
};

const calledNamesOf = (file: ts.SourceFile) => {
  const called = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) called.add(node.expression.text);

    ts.forEachChild(node, visit);
  };

  visit(file);

  return called;
};

/** What the plain functions a component imports from a relative app file inject, one level deep. */
const helperReasonsOf = (file: string, source: string) => {
  const parsed = sourceFileOf(source);
  const called = calledNamesOf(parsed);

  return [...importedFromOf(parsed)].flatMap(([name, module]) => {
    if (!RELATIVE_MODULE.test(module) || INJECT_FUNCTION.test(name) || !called.has(name)) return [];

    const helper = readModule(resolve(dirname(file), module));
    const helperFile = helper === null ? null : sourceFileOf(helper);
    const body = helperFile ? functionOf(helperFile, name) : null;

    if (!helperFile || !body) return [];

    return injectionsIn(body, importedFromOf(helperFile)).map(
      (injection) => `calls ${name}() from ${module}, which ${injection}`,
    );
  });
};

const componentReasonsOf = (root: string, component: string) => {
  const file = resolve(root, component);
  const source = existsSync(file) ? read(file) : null;

  if (source === null) return [];

  const templateUrl = source.match(TEMPLATE_URL)?.[1];
  const template = templateUrl ? (read(resolve(dirname(file), templateUrl)) ?? '') : '';

  return [...builderReasonsOf({ source, template }), ...helperReasonsOf(file, source)].map(
    (reason) => `${reason} (${component})`,
  );
};

const builderReasonsOfPart = (options: { product: ResolvedProduct; part: ResolvedPart }) => {
  const root = repoRootOf(options.product);
  const link = partLinkOf(options.part.source);
  const component = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;

  return [
    ...builderReasonsOf({ source: options.part.source }).map(
      (reason) => `${reason} (${relative(root, options.part.file)})`,
    ),
    ...(component ? componentReasonsOf(root, component) : []),
  ];
};

/** Who builds `part`: checked on its design file before the build and on its `implements` component after it. */
export const partBuilderOf = (options: { product: ResolvedProduct; part: ResolvedPart }): PartBuilder => {
  const reasons = builderReasonsOfPart(options);

  return reasons.length > 0 ? { builder: 'developer', reasons } : { builder: 'designer' };
};

/** Whether `part` loads data, on its design file or its `implements` component: it then must draw loading, error and empty. */
export const takesDataOf = (options: { product: ResolvedProduct; part: ResolvedPart }) =>
  builderReasonsOfPart(options).some((reason) => reason.startsWith(LOADS_DATA));

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
