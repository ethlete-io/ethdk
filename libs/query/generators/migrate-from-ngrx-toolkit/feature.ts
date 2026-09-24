import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { createSourceFile } from '../migrate-to-query-v3/shared.js';
import { TOOLKIT_TASK, ToolkitTaskInput } from './report.js';
import { lineOf } from './ts-edits.js';

export const TOOLKIT_MODULE = '@tomtomb/ngrx-toolkit';

export const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export type HttpVerb = (typeof HTTP_VERBS)[number];

export type ToolkitArgsKey = 'queryParams' | 'params' | 'body';

const TOOLKIT_ARGS_KEYS: readonly string[] = ['queryParams', 'params', 'body'];

export type ToolkitArgsMember = {
  typeText: string;
  declaredText: string;
  optional: boolean;
};

export type ToolkitArgs = {
  /** The args type as the action group names it, e.g. `Models.GetTeamArgs`. */
  typeText: string;
  members: Map<ToolkitArgsKey, ToolkitArgsMember>;
  extraKeys: string[];
};

export type ToolkitRoute = {
  /** The route as written in the service, valid as a v3 route as well. */
  text: string;
  /** `/items/{}/members` - the route with every path param blanked, for matching duplicates. */
  normalized: string | null;
  pathParams: string[];
  /** The route up to its first path param. */
  staticPrefix: string;
};

export type ToolkitCall = {
  name: string;
  verb: HttpVerb;
  args: ToolkitArgs | null;
  responseType: string | null;
  route: ToolkitRoute;
  serviceMethod: string;
  line: number;
};

export type ToolkitFeatureFiles = {
  actions: string;
  service: string | null;
  effects: string | null;
  reducer: string | null;
  selectors: string | null;
  facade: string | null;
  models: string | null;
};

export type ToolkitFeature = {
  dir: string;
  base: string;
  files: ToolkitFeatureFiles;
  queriesFile: string;
  calls: ToolkitCall[];
  /** Import statements of the actions file, minus the toolkit, for the queries file to start from. */
  actionImports: string[];
  apiBase: string | null;
  blockers: ToolkitTaskInput[];
  warnings: ToolkitTaskInput[];
};

type RawActionGroup = {
  name: string;
  argsType: ts.TypeNode | null;
  responseType: ts.TypeNode | null;
  line: number;
};

const FEATURE_FILE_SUFFIX = '.actions.ts';

const siblingFile = (tree: Tree, dir: string, base: string, kind: string) => {
  const path = `${dir}/${base}.${kind}.ts`;

  return tree.exists(path) ? path : null;
};

const propertyNamed = (object: ts.ObjectLiteralExpression, name: string) =>
  object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && property.name.getText() === name,
  );

const typeLiteralMember = (literal: ts.TypeLiteralNode, name: string) =>
  literal.members.find(
    (member): member is ts.PropertySignature => ts.isPropertySignature(member) && member.name.getText() === name,
  );

const isNullType = (node: ts.TypeNode) =>
  node.kind === ts.SyntaxKind.NullKeyword ||
  node.kind === ts.SyntaxKind.UndefinedKeyword ||
  (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword);

const parseActionGroup = (declaration: ts.VariableDeclaration, sourceFile: ts.SourceFile): RawActionGroup | null => {
  const initializer = declaration.initializer;

  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    !ts.isIdentifier(initializer.expression) ||
    initializer.expression.text !== 'createHttpActionGroup' ||
    !ts.isIdentifier(declaration.name)
  ) {
    return null;
  }

  const options = initializer.arguments[0];
  const argsTypes = options && ts.isObjectLiteralExpression(options) ? propertyNamed(options, 'argsTypes') : undefined;
  const defineCall = argsTypes?.initializer;
  const typeArgument = defineCall && ts.isCallExpression(defineCall) ? defineCall.typeArguments?.[0] : undefined;
  const literal = typeArgument && ts.isTypeLiteralNode(typeArgument) ? typeArgument : undefined;

  return {
    name: declaration.name.text,
    argsType: literal ? (typeLiteralMember(literal, 'args')?.type ?? null) : null,
    responseType: literal ? (typeLiteralMember(literal, 'response')?.type ?? null) : null,
    line: lineOf(sourceFile, declaration.getStart(sourceFile)),
  };
};

type ParsedActions = {
  groups: RawActionGroup[];
  imports: ts.ImportDeclaration[];
  foreign: ts.Statement[];
};

const parseActionsFile = (sourceFile: ts.SourceFile): ParsedActions => {
  const groups: RawActionGroup[] = [];
  const imports: ts.ImportDeclaration[] = [];
  const foreign: ts.Statement[] = [];
  const recordCandidates: ts.ObjectLiteralExpression[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      imports.push(statement);
      continue;
    }

    if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) {
      foreign.push(statement);
      continue;
    }

    const declaration = statement.declarationList.declarations[0]!;
    const initializer = declaration.initializer;
    const group = parseActionGroup(declaration, sourceFile);

    if (group) {
      groups.push(group);
    } else if (initializer && (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))) {
      continue;
    } else if (initializer && ts.isObjectLiteralExpression(initializer)) {
      recordCandidates.push(initializer);
    } else {
      foreign.push(statement);
    }
  }

  const groupNames = new Set(groups.map((group) => group.name));

  for (const record of recordCandidates) {
    const onlyGroups = record.properties.every((property) =>
      ts.isShorthandPropertyAssignment(property)
        ? groupNames.has(property.name.text)
        : ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.initializer) &&
          groupNames.has(property.initializer.text),
    );

    if (!onlyGroups) foreign.push(record.parent.parent.parent as ts.Statement);
  }

  return { groups, imports, foreign };
};

export const findTypeDeclaration = (sourceFile: ts.SourceFile, name: string) =>
  sourceFile.statements.find(
    (statement): statement is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name.text === name,
  );

type ArgsResolution = { args: ToolkitArgs; inherited: boolean } | { unresolved: string };

const membersToArgs = (
  typeText: string,
  members: ts.NodeArray<ts.TypeElement>,
  memberTypeText: (member: ts.PropertySignature, key: string) => string,
): ToolkitArgs => {
  const mapped = new Map<ToolkitArgsKey, ToolkitArgsMember>();
  const extraKeys: string[] = [];

  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.type) {
      extraKeys.push(member.name?.getText() ?? '?');
      continue;
    }

    const key = member.name.getText();

    if (TOOLKIT_ARGS_KEYS.includes(key)) {
      mapped.set(key as ToolkitArgsKey, {
        typeText: memberTypeText(member, key),
        declaredText: member.type.getText(),
        optional: !!member.questionToken,
      });
    } else {
      extraKeys.push(key);
    }
  }

  return { typeText, members: mapped, extraKeys };
};

const resolveArgs = (
  tree: Tree,
  graph: ModuleGraph,
  actionsFile: string,
  actionsSource: ts.SourceFile,
  argsType: ts.TypeNode,
): ArgsResolution => {
  const typeText = argsType.getText(actionsSource);

  if (ts.isTypeLiteralNode(argsType)) {
    return {
      args: membersToArgs(typeText, argsType.members, (member) => member.type!.getText(actionsSource)),
      inherited: false,
    };
  }

  if (!ts.isTypeReferenceNode(argsType) || argsType.typeArguments) {
    return { unresolved: `\`${typeText}\` is neither a type literal nor a plain type reference.` };
  }

  const typeName = argsType.typeName;
  const [namespaceName, symbolName] = ts.isQualifiedName(typeName)
    ? [ts.isIdentifier(typeName.left) ? typeName.left.text : null, typeName.right.text]
    : [null, typeName.text];

  let declaringFile: string | null = null;

  if (!namespaceName && findTypeDeclaration(actionsSource, symbolName)) {
    declaringFile = actionsFile;
  }

  for (const statement of actionsSource.statements) {
    if (declaringFile || !ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const bindings = statement.importClause?.namedBindings;
    const specifier = statement.moduleSpecifier.text;

    if (namespaceName && bindings && ts.isNamespaceImport(bindings) && bindings.name.text === namespaceName) {
      declaringFile = graph.findDeclaringFile(actionsFile, specifier, symbolName);
    }

    if (!namespaceName && bindings && ts.isNamedImports(bindings)) {
      const element = bindings.elements.find((candidate) => candidate.name.text === symbolName);

      if (element) {
        declaringFile = graph.findDeclaringFile(actionsFile, specifier, element.propertyName?.text ?? symbolName);
      }
    }
  }

  const declaringContent = declaringFile ? tree.read(declaringFile, 'utf-8') : null;

  if (!declaringFile || !declaringContent) {
    return { unresolved: `\`${typeText}\` does not resolve to a declaration in the workspace.` };
  }

  const declaration = findTypeDeclaration(createSourceFile(declaringContent, declaringFile), symbolName);
  const indexed = (_member: ts.PropertySignature, key: string) => `${typeText}['${key}']`;

  if (declaration && ts.isInterfaceDeclaration(declaration) && !declaration.typeParameters) {
    return {
      args: membersToArgs(typeText, declaration.members, indexed),
      inherited: !!declaration.heritageClauses?.length,
    };
  }

  if (declaration && ts.isTypeAliasDeclaration(declaration) && ts.isTypeLiteralNode(declaration.type)) {
    return { args: membersToArgs(typeText, declaration.type.members, indexed), inherited: false };
  }

  return { unresolved: `\`${typeText}\` is not an interface or type literal.` };
};

type ParsedEffects = {
  serviceMethods: Map<string, string>;
  foreign: ts.Node[];
};

const actionNameOf = (expression: ts.Expression) => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;

  return null;
};

const parseEffectsFile = (sourceFile: ts.SourceFile): ParsedEffects => {
  const serviceMethods = new Map<string, string>();
  const foreign: ts.Node[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement)) continue;

    for (const member of statement.members) {
      if (ts.isConstructorDeclaration(member)) continue;

      const initializer = ts.isPropertyDeclaration(member) ? member.initializer : undefined;
      const callee = initializer && ts.isCallExpression(initializer) ? initializer.expression : undefined;
      const options = initializer && ts.isCallExpression(initializer) ? initializer.arguments[0] : undefined;

      if (
        !callee ||
        !ts.isPropertyAccessExpression(callee) ||
        callee.expression.kind !== ts.SyntaxKind.ThisKeyword ||
        !/^onAction(Merge|Switch|Exhaust|Concat)Map$/.test(callee.name.text) ||
        !options ||
        !ts.isObjectLiteralExpression(options) ||
        options.properties.length !== 2
      ) {
        foreign.push(member);
        continue;
      }

      const action = propertyNamed(options, 'action')?.initializer;
      const serviceCall = propertyNamed(options, 'serviceCall')?.initializer;
      const actionName = action ? actionNameOf(action) : null;

      if (!actionName || !serviceCall || !ts.isPropertyAccessExpression(serviceCall)) {
        foreign.push(member);
        continue;
      }

      serviceMethods.set(actionName, serviceCall.name.text);
    }
  }

  return { serviceMethods, foreign };
};

const isReducerPlainSlice = (content: string) => {
  const sourceFile = createSourceFile(content);
  let slice = false;
  let foreign = false;

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'createReducerSlice') {
        slice = true;

        const options = node.arguments[0];
        const extra =
          options && ts.isObjectLiteralExpression(options) ? propertyNamed(options, 'initialStateExtra') : null;

        if (extra && !(ts.isObjectLiteralExpression(extra.initializer) && extra.initializer.properties.length === 0)) {
          foreign = true;
        }
      }

      if (node.expression.text === 'createReducer' || node.expression.text === 'on') foreign = true;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return slice && !foreign;
};

type ServiceMethod = { route: ToolkitRoute; verb: HttpVerb; headers: boolean; cacheExpiry: boolean };

type ParsedService = {
  apiBase: string | null;
  baseConfig: boolean;
  methods: Map<string, ServiceMethod | string>;
};

const parseRoute = (node: ts.Expression, sourceFile: ts.SourceFile): ToolkitRoute | string => {
  const text = node.getText(sourceFile);

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text, normalized: node.text, pathParams: [], staticPrefix: node.text };
  }

  if (!ts.isArrowFunction(node) || node.parameters.length !== 1 || !ts.isIdentifier(node.parameters[0]!.name)) {
    return `The route \`${text}\` is not a string or a \`(p) => \\\`…\\\`\` function.`;
  }

  const paramName = node.parameters[0]!.name.text;
  const body = node.body;

  if (ts.isStringLiteral(body) || ts.isNoSubstitutionTemplateLiteral(body)) {
    return { text, normalized: body.text, pathParams: [], staticPrefix: body.text };
  }

  if (!ts.isTemplateExpression(body)) {
    return `The route \`${text}\` does not return a template string.`;
  }

  const pathParams: string[] = [];
  let normalized = body.head.text;

  for (const span of body.templateSpans) {
    const expression = span.expression;

    if (
      !ts.isPropertyAccessExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      expression.expression.text !== paramName
    ) {
      return `The route \`${text}\` reads something other than its path params.`;
    }

    pathParams.push(expression.name.text);
    normalized += `{}${span.literal.text}`;
  }

  return { text, normalized, pathParams, staticPrefix: body.head.text };
};

const parseServiceMethod = (method: ts.MethodDeclaration, sourceFile: ts.SourceFile): ServiceMethod | string => {
  const statements = method.body?.statements ?? [];
  const statement = statements[0];
  const call = statement && ts.isReturnStatement(statement) ? statement.expression : undefined;
  const paramName =
    method.parameters.length === 1 && ts.isIdentifier(method.parameters[0]!.name)
      ? method.parameters[0]!.name.text
      : null;

  if (
    statements.length !== 1 ||
    !call ||
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.expression.kind !== ts.SyntaxKind.ThisKeyword ||
    !(HTTP_VERBS as readonly string[]).includes(call.expression.name.text)
  ) {
    return 'The method is not a single `return this.get|post|put|patch|delete({ … })`.';
  }

  const options = call.arguments[0];

  if (!options || !ts.isObjectLiteralExpression(options)) {
    return 'The request options are not an object literal.';
  }

  let route: ToolkitRoute | string = 'The method has no `apiRoute`.';
  let headers = false;
  let cacheExpiry = false;

  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property)) return `Unsupported option \`${property.getText(sourceFile)}\`.`;

    const name = property.name.getText(sourceFile);
    const value = property.initializer;

    if (name === 'apiRoute') {
      route = parseRoute(value, sourceFile);
    } else if (name === 'responseType') {
      continue;
    } else if (name === 'httpOpts') {
      if (ts.isIdentifier(value) && value.text === paramName) continue;

      const spreadsArgs =
        ts.isObjectLiteralExpression(value) &&
        value.properties.every(
          (element) =>
            (ts.isSpreadAssignment(element) &&
              ts.isIdentifier(element.expression) &&
              element.expression.text === paramName) ||
            (ts.isPropertyAssignment(element) && element.name.getText(sourceFile) === 'headers'),
        );

      if (!spreadsArgs) return `Unsupported \`httpOpts\`: \`${value.getText(sourceFile)}\`.`;

      headers = true;
    } else if (name === 'extras') {
      if (!ts.isObjectLiteralExpression(value)) return `Unsupported \`extras\`: \`${value.getText(sourceFile)}\`.`;

      for (const extra of value.properties) {
        const extraName = extra.name?.getText(sourceFile);

        if (extraName === 'skipCache') continue;

        if (extraName === 'cacheExpiresIn') {
          cacheExpiry = true;
          continue;
        }

        if (extraName === 'apiBaseOverride') return 'apiBaseOverride';

        return `Unsupported extra \`${extra.getText(sourceFile)}\`.`;
      }
    } else {
      return `Unsupported option \`${name}\`.`;
    }
  }

  if (typeof route === 'string') return route;

  return { route, verb: call.expression.name.text as HttpVerb, headers, cacheExpiry };
};

const parseServiceFile = (sourceFile: ts.SourceFile): ParsedService => {
  const methods = new Map<string, ServiceMethod | string>();
  let apiBase: string | null = null;
  let baseConfig = false;

  const findSuper = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      apiBase = node.arguments[1]?.getText(sourceFile) ?? null;
      baseConfig = node.arguments.length > 2;
    }

    ts.forEachChild(node, findSuper);
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement)) continue;

    for (const member of statement.members) {
      if (ts.isConstructorDeclaration(member)) findSuper(member);

      if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
        methods.set(member.name.text, parseServiceMethod(member, sourceFile));
      }
    }
  }

  return { apiBase, baseConfig, methods };
};

const hasToolkitImport = (sourceFile: ts.SourceFile) =>
  sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === TOOLKIT_MODULE,
  );

const extendsFacadeBase = (sourceFile: ts.SourceFile) =>
  sourceFile.statements.some(
    (statement) =>
      ts.isClassDeclaration(statement) &&
      !!statement.heritageClauses?.some((clause) =>
        clause.types.some((type) => type.expression.getText(sourceFile) === 'FacadeBase'),
      ),
  );

export type DiscoveredFeatures = {
  features: ToolkitFeature[];
  /** Facades that extend `FacadeBase` in a folder without HTTP action groups. */
  facadesWithoutHttp: string[];
  commentedOut: string[];
};

/** Finds every `x.actions.ts` built with `createHttpActionGroup` and reads the feature around it. */
export const discoverFeatures = (
  tree: Tree,
  graph: ModuleGraph,
  visit: (callback: (filePath: string) => void) => void,
): DiscoveredFeatures => {
  const features: ToolkitFeature[] = [];
  const facadesWithoutHttp: string[] = [];
  const commentedOut: string[] = [];

  visit((filePath) => {
    if (!filePath.endsWith(FEATURE_FILE_SUFFIX)) return;

    const content = tree.read(filePath, 'utf-8');

    if (!content) return;

    const sourceFile = createSourceFile(content, filePath);
    const dir = filePath.slice(0, filePath.lastIndexOf('/'));
    const base = filePath.slice(dir.length + 1, -FEATURE_FILE_SUFFIX.length);
    const parsed = parseActionsFile(sourceFile);

    if (parsed.groups.length === 0) {
      const facade = siblingFile(tree, dir, base, 'facade');
      const facadeContent = facade ? tree.read(facade, 'utf-8') : null;

      if (facade && facadeContent && extendsFacadeBase(createSourceFile(facadeContent, facade))) {
        facadesWithoutHttp.push(facade);
      } else if (/createHttpActionGroup/.test(content) && !hasToolkitImport(sourceFile)) {
        commentedOut.push(filePath);
      }

      return;
    }

    features.push(analyzeFeature(tree, graph, { filePath, sourceFile, dir, base, parsed }));
  });

  return { features, facadesWithoutHttp, commentedOut };
};

type FeatureInput = {
  filePath: string;
  sourceFile: ts.SourceFile;
  dir: string;
  base: string;
  parsed: ParsedActions;
};

const analyzeFeature = (tree: Tree, graph: ModuleGraph, input: FeatureInput): ToolkitFeature => {
  const { filePath, sourceFile, dir, base, parsed } = input;
  const files: ToolkitFeatureFiles = {
    actions: filePath,
    service: siblingFile(tree, dir, base, 'service'),
    effects: siblingFile(tree, dir, base, 'effects'),
    reducer: siblingFile(tree, dir, base, 'reducer'),
    selectors: siblingFile(tree, dir, base, 'selectors'),
    facade: siblingFile(tree, dir, base, 'facade'),
    models: siblingFile(tree, dir, base, 'models'),
  };

  const blockers: ToolkitTaskInput[] = [];
  const warnings: ToolkitTaskInput[] = [];
  const calls: ToolkitCall[] = [];

  for (const statement of parsed.foreign) {
    blockers.push({
      id: TOOLKIT_TASK.MIXED_ACTIONS,
      summary: `\`${statement.getText(sourceFile).split('\n')[0]}\` is not an HTTP action group.`,
      locations: [{ filePath, line: lineOf(sourceFile, statement.getStart(sourceFile)) }],
    });
  }

  const readSource = (path: string | null) => {
    const content = path ? tree.read(path, 'utf-8') : null;

    return path && content ? createSourceFile(content, path) : null;
  };

  const effectsSource = readSource(files.effects);
  const effects = effectsSource ? parseEffectsFile(effectsSource) : { serviceMethods: new Map(), foreign: [] };

  for (const member of effects.foreign) {
    blockers.push({
      id: TOOLKIT_TASK.CUSTOM_EFFECT,
      summary: `\`${member.getText(effectsSource!).split('\n')[0]}\` is not a plain \`onAction*Map\` effect.`,
      locations: [{ filePath: files.effects!, line: lineOf(effectsSource!, member.getStart(effectsSource!)) }],
    });
  }

  const reducerContent = files.reducer ? tree.read(files.reducer, 'utf-8') : null;

  if (files.reducer && reducerContent && !isReducerPlainSlice(reducerContent)) {
    blockers.push({
      id: TOOLKIT_TASK.CUSTOM_REDUCER,
      summary: `The reducer of \`${base}\` is not a plain \`createReducerSlice\` with an empty \`initialStateExtra\`.`,
      locations: [{ filePath: files.reducer }],
    });
  }

  const serviceSource = readSource(files.service);
  const service = serviceSource ? parseServiceFile(serviceSource) : null;

  if (service?.baseConfig) {
    blockers.push({
      id: TOOLKIT_TASK.SERVICE_API_BASE,
      summary: 'The service passes a base config to `ServiceBase`.',
      locations: [{ filePath: files.service! }],
    });
  }

  for (const group of parsed.groups) {
    const location = { filePath, line: group.line };
    const serviceMethod = effects.serviceMethods.get(group.name);

    if (!serviceMethod) {
      blockers.push({
        id: TOOLKIT_TASK.ACTION_WITHOUT_EFFECT,
        summary: `\`${group.name}\` has no effect in ${files.effects ?? `${base}.effects.ts`}.`,
        locations: [location],
      });
      continue;
    }

    const method = service?.methods.get(serviceMethod);

    if (!method || typeof method === 'string') {
      const apiBaseOverride = method === 'apiBaseOverride';

      blockers.push({
        id: apiBaseOverride ? TOOLKIT_TASK.SERVICE_API_BASE : TOOLKIT_TASK.SERVICE_UNSUPPORTED,
        summary: apiBaseOverride
          ? `\`${serviceMethod}\` overrides the API base.`
          : `\`${serviceMethod}\`: ${method ?? 'the service has no such method.'}`,
        locations: [{ filePath: files.service ?? filePath }],
      });
      continue;
    }

    if (method.headers) {
      warnings.push({
        id: TOOLKIT_TASK.SERVICE_HEADERS,
        summary: `\`${serviceMethod}\` added headers to the request; the creator \`${group.name}\` does not.`,
        locations: [{ filePath: files.service! }],
      });
    }

    if (method.cacheExpiry) {
      warnings.push({
        id: TOOLKIT_TASK.SERVICE_CACHE_EXPIRY,
        summary: `\`${serviceMethod}\` cached its response with \`cacheExpiresIn\`.`,
        locations: [{ filePath: files.service! }],
      });
    }

    let args: ToolkitArgs | null = null;

    if (group.argsType && !isNullType(group.argsType)) {
      const resolution = resolveArgs(tree, graph, filePath, sourceFile, group.argsType);

      if ('unresolved' in resolution) {
        blockers.push({ id: TOOLKIT_TASK.ARGS_UNRESOLVED, summary: resolution.unresolved, locations: [location] });
        continue;
      }

      if (resolution.inherited) {
        warnings.push({
          id: TOOLKIT_TASK.ARGS_INHERITED,
          summary: `\`${resolution.args.typeText}\` (args of \`${group.name}\`) extends another type.`,
          locations: [location],
        });
      }

      args = resolution.args;
    }

    if (method.route.pathParams.length > 0 && !args?.members.has('queryParams')) {
      blockers.push({
        id: TOOLKIT_TASK.ARGS_UNRESOLVED,
        summary: `The route of \`${group.name}\` has path params, but its args have no \`queryParams\`.`,
        locations: [location],
      });
      continue;
    }

    calls.push({
      name: group.name,
      verb: method.verb,
      args,
      responseType: group.responseType ? group.responseType.getText(sourceFile) : null,
      route: method.route,
      serviceMethod,
      line: group.line,
    });
  }

  const actionImports = parsed.imports
    .filter(
      (statement) =>
        !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== TOOLKIT_MODULE,
    )
    .map((statement) => statement.getText(sourceFile));

  return {
    dir,
    base,
    files,
    queriesFile: `${dir}/${base}.queries.ts`,
    calls,
    actionImports,
    apiBase: service?.apiBase ?? null,
    blockers,
    warnings,
  };
};
