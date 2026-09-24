import { Tree, getProjects } from '@nx/devkit';
import * as ts from 'typescript';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { capitalizeFirstLetter, createSourceFile } from '../migrate-to-query-v3/shared.js';
import { HTTP_VERBS, HttpVerb, ToolkitCall, ToolkitFeature, findTypeDeclaration } from './feature.js';
import { TOOLKIT_TASK, ToolkitMigrationReport } from './report.js';
import { hasExportModifier, lineOf, pruneUnusedImports, relativeSpecifier } from './ts-edits.js';

export type ClientHelpers = {
  /** `publicApi` for `publicApiClient` / `publicApiClientConfig` - the prefix of `publicApiGet`, `publicApiPostSecure`, … */
  baseName: string;
  /** A module specifier, or a workspace file that is imported relatively. */
  importFrom: string;
  publicRoutes: string[] | null;
};

export const clientBaseName = (client: string) => client.replace(/Config$/, '').replace(/Client$/, '');

export const helperName = (helpers: ClientHelpers, verb: HttpVerb, secure: boolean) =>
  `${helpers.baseName}${capitalizeFirstLetter(verb)}${secure ? 'Secure' : ''}`;

const normalizeType = (text: string) => text.replace(/\s+/g, ' ').replace(/;\s*}/g, ' }').trim();

export const isPublicRoute = (helpers: ClientHelpers, staticPrefix: string) => {
  if (!helpers.publicRoutes) return true;

  return helpers.publicRoutes.some((prefix) => {
    if (!staticPrefix.startsWith(prefix)) return false;

    const next = staticPrefix[prefix.length];

    return next === undefined || next === '/' || next === '?' || prefix.endsWith('/');
  });
};

export type ExistingCreator = {
  filePath: string;
  name: string;
  verb: HttpVerb;
  normalizedRoute: string;
  pathParams: string[];
  responseType: string | null;
  /** `null` when the args type is not written as literals and plain interfaces the generator can read. */
  args: CreatorArgTexts | null;
  line: number;
};

type CreatorArgTexts = { queryParams: string | null; body: string | null };

const COMPARED_ARG_KEYS = ['queryParams', 'body'] as const;

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

const memberText = (member: ts.PropertySignature) =>
  `${member.questionToken ? '?' : ''}${normalizeType(withoutComments(member.type!.getText()))}`;

const collectArgMembers = (members: ts.NodeArray<ts.TypeElement>, into: CreatorArgTexts) => {
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.type) continue;

    const key = member.name.getText();

    if (key === 'queryParams' || key === 'body') into[key] = memberText(member);
  }
};

const referencedMembers = (
  tree: Tree,
  graph: ModuleGraph,
  filePath: string,
  sourceFile: ts.SourceFile,
  reference: ts.TypeReferenceNode,
) => {
  if (reference.typeArguments || !ts.isIdentifier(reference.typeName)) return null;

  const name = reference.typeName.text;
  let declaration = findTypeDeclaration(sourceFile, name);

  for (const statement of sourceFile.statements) {
    if (declaration) break;

    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const named = statement.importClause?.namedBindings;

    if (!named || !ts.isNamedImports(named)) continue;

    const element = named.elements.find((candidate) => candidate.name.text === name);
    const importedName = element?.propertyName?.text ?? name;
    const declaringFile = element
      ? graph.findDeclaringFile(filePath, statement.moduleSpecifier.text, importedName)
      : null;
    const content = declaringFile ? tree.read(declaringFile, 'utf-8') : null;

    if (declaringFile && content) {
      declaration = findTypeDeclaration(createSourceFile(content, declaringFile), importedName);
    }
  }

  if (declaration && ts.isInterfaceDeclaration(declaration) && !declaration.typeParameters) {
    return declaration.heritageClauses?.length ? null : declaration.members;
  }

  if (declaration && ts.isTypeAliasDeclaration(declaration) && ts.isTypeLiteralNode(declaration.type)) {
    return declaration.type.members;
  }

  return null;
};

const creatorArgsOf = (
  tree: Tree,
  graph: ModuleGraph,
  filePath: string,
  sourceFile: ts.SourceFile,
  typeArgument: ts.TypeNode | undefined,
): CreatorArgTexts | null => {
  const texts: CreatorArgTexts = { queryParams: null, body: null };

  if (!typeArgument) return texts;

  const parts = ts.isIntersectionTypeNode(typeArgument) ? typeArgument.types : [typeArgument];

  for (const part of parts) {
    const members = ts.isTypeLiteralNode(part)
      ? part.members
      : ts.isTypeReferenceNode(part)
        ? referencedMembers(tree, graph, filePath, sourceFile, part)
        : null;

    if (!members) return null;

    collectArgMembers(members, texts);
  }

  return texts;
};

const toolkitArgTexts = (call: ToolkitCall): CreatorArgTexts => {
  const text = (key: 'params' | 'body') => {
    const member = call.args?.members.get(key);

    return member ? `${member.optional ? '?' : ''}${normalizeType(withoutComments(member.declaredText))}` : null;
  };

  return { queryParams: text('params'), body: text('body') };
};

const routeOf = (node: ts.Expression) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { normalized: node.text, pathParams: [] as string[] };
  }

  if (!ts.isArrowFunction(node) || node.parameters.length !== 1) return null;

  const param = node.parameters[0]!.name;
  const body = node.body;

  if (ts.isStringLiteral(body) || ts.isNoSubstitutionTemplateLiteral(body)) {
    return { normalized: body.text, pathParams: [] as string[] };
  }

  if (!ts.isIdentifier(param) || !ts.isTemplateExpression(body)) return null;

  const pathParams: string[] = [];
  let normalized = body.head.text;

  for (const span of body.templateSpans) {
    const expression = span.expression;

    if (
      !ts.isPropertyAccessExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      expression.expression.text !== param.text
    ) {
      return null;
    }

    pathParams.push(expression.name.text);
    normalized += `{}${span.literal.text}`;
  }

  return { normalized, pathParams };
};

const responseTypeOf = (typeArgument: ts.TypeNode | undefined, sourceFile: ts.SourceFile): string | null => {
  if (!typeArgument) return null;

  const literals = ts.isIntersectionTypeNode(typeArgument)
    ? typeArgument.types.filter(ts.isTypeLiteralNode)
    : ts.isTypeLiteralNode(typeArgument)
      ? [typeArgument]
      : [];

  for (const literal of literals) {
    for (const member of literal.members) {
      if (ts.isPropertySignature(member) && member.name.getText(sourceFile) === 'response' && member.type) {
        return normalizeType(member.type.getText(sourceFile));
      }
    }
  }

  return null;
};

/** Every `export const x = <client><Verb>[Secure](route)` in the scope - the v3 creators D6 may reuse. */
export const indexExistingCreators = (
  tree: Tree,
  graph: ModuleGraph,
  helpers: ClientHelpers,
  visit: (callback: (filePath: string) => void) => void,
) => {
  const helperVerbs = new Map<string, HttpVerb>();

  for (const verb of HTTP_VERBS) {
    helperVerbs.set(helperName(helpers, verb, false), verb);
    helperVerbs.set(helperName(helpers, verb, true), verb);
  }

  const creators: ExistingCreator[] = [];

  visit((filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content || ![...helperVerbs.keys()].some((name) => content.includes(name))) return;

    const sourceFile = createSourceFile(content, filePath);

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue;

      for (const declaration of statement.declarationList.declarations) {
        const call = declaration.initializer;

        if (
          !ts.isIdentifier(declaration.name) ||
          !call ||
          !ts.isCallExpression(call) ||
          !ts.isIdentifier(call.expression)
        ) {
          continue;
        }

        const verb = helperVerbs.get(call.expression.text);
        const route = call.arguments[0] ? routeOf(call.arguments[0]) : null;

        if (!verb || !route) continue;

        creators.push({
          filePath,
          name: declaration.name.text,
          verb,
          normalizedRoute: route.normalized,
          pathParams: route.pathParams,
          responseType: responseTypeOf(call.typeArguments?.[0], sourceFile),
          args: creatorArgsOf(tree, graph, filePath, sourceFile, call.typeArguments?.[0]),
          line: lineOf(sourceFile, declaration.getStart(sourceFile)),
        });
      }
    }
  });

  return creators;
};

const projectRootOf = (tree: Tree, filePath: string) => {
  let best: string | null = null;

  for (const project of getProjects(tree).values()) {
    const root = project.root === '.' ? '' : project.root;

    if ((root === '' || filePath.startsWith(`${root}/`)) && (best === null || root.length > best.length)) {
      best = root;
    }
  }

  return best;
};

/** How `fromFile` can import `symbol` from `declaringFile`: relatively inside one project, else through a path alias. */
export const importSpecifierFor = (
  tree: Tree,
  graph: ModuleGraph,
  fromFile: string,
  declaringFile: string,
  symbol: string,
) => {
  const fromRoot = projectRootOf(tree, fromFile);

  if (fromRoot !== null && fromRoot === projectRootOf(tree, declaringFile)) {
    return relativeSpecifier(fromFile, declaringFile);
  }

  for (const alias of graph.pathAliases()) {
    if (alias.includes('*')) continue;

    if (graph.findDeclaringFile(fromFile, alias, symbol) === declaringFile) return alias;
  }

  return fromRoot === null && projectRootOf(tree, declaringFile) === null
    ? relativeSpecifier(fromFile, declaringFile)
    : null;
};

const creatorTypeParameter = (call: ToolkitCall) => {
  const members: string[] = [];

  const renamed = { queryParams: 'pathParams', params: 'queryParams', body: 'body' } as const;

  for (const [key, member] of call.args?.members ?? []) {
    members.push(`${renamed[key]}${member.optional ? '?' : ''}: ${member.typeText}`);
  }

  if (call.responseType) members.push(`response: ${call.responseType}`);

  return members.length > 0 ? `<{ ${members.join('; ')} }>` : '';
};

const creatorRoute = (call: ToolkitCall) => {
  const hasPathParams = call.args?.members.has('queryParams') ?? false;

  return hasPathParams && call.route.pathParams.length === 0 && !call.route.text.includes('=>')
    ? `() => ${call.route.text}`
    : call.route.text;
};

export type QueriesFileResult = {
  written: number;
  reused: number;
};

type ReuseDecision = { reuse: ExistingCreator; specifier: string } | { mismatch: string } | null;

const decideReuse = (
  tree: Tree,
  graph: ModuleGraph,
  feature: ToolkitFeature,
  call: ToolkitCall,
  existing: readonly ExistingCreator[],
): ReuseDecision => {
  if (call.route.normalized === null) return null;

  const sameRoute = existing.filter(
    (creator) => creator.verb === call.verb && creator.normalizedRoute === call.route.normalized,
  );

  if (sameRoute.length === 0) return null;

  const response = call.responseType ? normalizeType(call.responseType) : null;
  const argTexts = toolkitArgTexts(call);
  const argMismatch = (creator: ExistingCreator) =>
    COMPARED_ARG_KEYS.find((key) => creator.args?.[key] !== argTexts[key]) ?? null;
  const match = sameRoute.find(
    (creator) =>
      creator.responseType === response &&
      creator.pathParams.join(',') === call.route.pathParams.join(',') &&
      argMismatch(creator) === null,
  );

  if (!match) {
    const other = sameRoute[0]!;
    const differingKey = argMismatch(other);
    const describe = (text: string | null) => {
      if (text === null) return 'none';

      const type = text.replace(/^\?/, '');

      return `\`${type.length > 120 ? `${type.slice(0, 120)}…` : type}\``;
    };
    const reason =
      other.pathParams.join(',') !== call.route.pathParams.join(',')
        ? 'its path params are named differently'
        : other.responseType === null
          ? 'its response type is not written inline, so it cannot be compared'
          : other.responseType !== response
            ? `its response is \`${other.responseType}\`, not \`${response ?? 'unknown'}\``
            : other.args === null
              ? 'its args type is not an interface or type literal, so it cannot be compared'
              : `its ${differingKey === 'body' ? 'body' : 'query params'} are ${describe(other.args[differingKey!])}, not ${describe(argTexts[differingKey!])}`;

    return {
      mismatch: `\`${call.name}\` got its own creator: \`${other.name}\` (${other.filePath}:${other.line}) has the same ${call.verb.toUpperCase()} route, but ${reason}.`,
    };
  }

  const specifier = importSpecifierFor(tree, graph, feature.queriesFile, match.filePath, match.name);

  if (!specifier) {
    return {
      mismatch: `\`${call.name}\` got its own creator: \`${match.name}\` (${match.filePath}:${match.line}) matches, but no path alias exports it to ${feature.queriesFile}.`,
    };
  }

  return { reuse: match, specifier };
};

const clientSpecifier = (tree: Tree, helpers: ClientHelpers, fromFile: string) =>
  tree.exists(helpers.importFrom) ? relativeSpecifier(fromFile, helpers.importFrom) : helpers.importFrom;

/** Writes `x.queries.ts`: one v3 creator per action group, or a re-export of an existing creator for the same route. */
export const writeQueriesFile = (
  tree: Tree,
  graph: ModuleGraph,
  feature: ToolkitFeature,
  helpers: ClientHelpers,
  existing: readonly ExistingCreator[],
  report: ToolkitMigrationReport,
): QueriesFileResult => {
  const helperImports = new Set<string>();
  const reExports: string[] = [];
  const declarations: string[] = [];
  let reused = 0;

  for (const call of feature.calls) {
    const decision = decideReuse(tree, graph, feature, call, existing);

    if (decision && 'reuse' in decision) {
      const { reuse, specifier } = decision;
      const binding = reuse.name === call.name ? call.name : `${reuse.name} as ${call.name}`;

      reExports.push(`export { ${binding} } from '${specifier}';`);
      reused += 1;
      continue;
    }

    if (decision && 'mismatch' in decision) {
      report.add({
        id: TOOLKIT_TASK.DUPLICATE_ROUTE_MISMATCH,
        summary: decision.mismatch,
        locations: [{ filePath: feature.queriesFile }],
      });
    }

    const helper = helperName(helpers, call.verb, !isPublicRoute(helpers, call.route.staticPrefix));

    helperImports.add(helper);
    declarations.push(`export const ${call.name} = ${helper}${creatorTypeParameter(call)}(${creatorRoute(call)});`);
  }

  const imports = [...feature.actionImports];

  if (helperImports.size > 0) {
    imports.push(
      `import { ${[...helperImports].sort().join(', ')} } from '${clientSpecifier(tree, helpers, feature.queriesFile)}';`,
    );
  }

  const content = [imports.join('\n'), reExports.join('\n'), declarations.join('\n\n')]
    .filter((part) => part.length > 0)
    .join('\n\n');

  tree.write(feature.queriesFile, `${pruneUnusedImports(`${content}\n`)}`);

  return { written: declarations.length, reused };
};
