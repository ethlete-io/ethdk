import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { createSourceFile, ensureNamedImports } from '../migrate-to-query-v3/shared.js';
import { INTEROP_MODULE } from './facade.js';
import { TOOLKIT_MODULE } from './feature.js';
import { ToolkitMigrationReport, ToolkitTaskInput } from './report.js';
import { TextEdit, applyEdits, collectUsedIdentifiers, lineOf, removeStatement } from './ts-edits.js';

export const CONSUMER_TASK = {
  UNSUPPORTED_IMPORT: 'NTK-UNSUPPORTED-IMPORT',
  UNCONVERTED_ACTION_GROUP: 'NTK-UNCONVERTED-ACTION-GROUP',
  SELECT_BY_ACTION_ID: 'NTK-SELECT-BY-ACTION-ID',
  AUTH_INTERCEPTOR: 'NTK-AUTH-INTERCEPTOR',
} as const;

const defineConsumerTasks = (report: ToolkitMigrationReport) => {
  report.define(CONSUMER_TASK.UNSUPPORTED_IMPORT, {
    title: 'Toolkit symbol without an interop counterpart',
    action:
      '`@ethlete/query/ngrx-toolkit` does not export the listed symbols, so the file still imports them from `@tomtomb/ngrx-toolkit`. Rewrite the code that uses them, then drop the import.',
  });
  report.define(CONSUMER_TASK.UNCONVERTED_ACTION_GROUP, {
    title: 'Consumer types name an action group that is still on the toolkit',
    action:
      'The file was left on `@tomtomb/ngrx-toolkit` because a `MappedEntityState` / `ActionCallArgs` type names an action group whose feature was not converted. Resolve that feature’s task, then re-run the generator.',
  });
  report.define(CONSUMER_TASK.SELECT_BY_ACTION_ID, {
    title: 'Handle looked up by action id',
    action:
      'The interop has no action ids. Pass the args instead and look the handle up with `toolkitSelect(creator, args, { injector })` - equal args return the handle `toolkitCall` created.',
  });
  report.define(CONSUMER_TASK.AUTH_INTERCEPTOR, {
    title: 'HTTP interceptor attaches the bearer token',
    action:
      'v3 secure creators already send the token, so this interceptor sends it twice, and it adds it to every other `HttpClient` call too - third-party hosts included. Delete it and its registration. Requests it skipped must use public creators: pass their prefixes as `--publicRoutes` and re-run.',
  });
};

const INTEROP_SYMBOLS = new Set([
  'toolkitCall',
  'toolkitSelect',
  'MappedEntityState',
  'ActionCallArgs',
  'ToolkitError',
  'CallState',
  'SuspensePipe',
  'SuspenseMultiPipe',
  'NgRxToolkitModule',
  'joinLoading',
  'joinErrors',
]);

const RENAMED_SYMBOLS = new Map([['Error', 'ToolkitError']]);

const STORE_SIDE_SYMBOLS = new Set([
  'FacadeBase',
  'EffectBase',
  'ServiceBase',
  'createHttpActionGroup',
  'createReducerSlice',
  'createEntitySelectors',
  'defineArgTypes',
  'defineResponseType',
]);

const HANDLE_TYPES = new Set(['MappedEntityState', 'ActionCallArgs']);

const code = (text: string) => (text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``);

export type ToolkitConsumerStats = {
  filesRewritten: number;
  filesLeftOnToolkit: number;
  refreshSitesRewritten: number;
  interceptorsFound: number;
};

type ToolkitImportElement = {
  imported: string;
  local: string;
  typeOnly: boolean;
};

const toolkitImportsOf = (sourceFile: ts.SourceFile) =>
  sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === TOOLKIT_MODULE,
  );

const elementsOf = (declaration: ts.ImportDeclaration): ToolkitImportElement[] => {
  const bindings = declaration.importClause?.namedBindings;

  if (!bindings || !ts.isNamedImports(bindings)) return [];

  return bindings.elements.map((element) => ({
    imported: element.propertyName?.text ?? element.name.text,
    local: element.name.text,
    typeOnly: element.isTypeOnly || !!declaration.importClause?.isTypeOnly,
  }));
};

const namedImportOf = (sourceFile: ts.SourceFile, local: string) => {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const bindings = statement.importClause?.namedBindings;

    if (bindings && ts.isNamespaceImport(bindings) && bindings.name.text === local) {
      return { statement, specifier: statement.moduleSpecifier.text, namespace: true, imported: local };
    }

    if (bindings && ts.isNamedImports(bindings)) {
      const element = bindings.elements.find((candidate) => candidate.name.text === local);

      if (element) {
        return {
          statement,
          specifier: statement.moduleSpecifier.text,
          namespace: false,
          imported: element.propertyName?.text ?? local,
        };
      }
    }
  }

  return null;
};

const isToolkitActionsFile = (tree: Tree, filePath: string | null) =>
  !!filePath && filePath.endsWith('.actions.ts') && !!tree.read(filePath, 'utf-8')?.includes('createHttpActionGroup');

const unconvertedTypeQueries = (
  tree: Tree,
  graph: ModuleGraph,
  filePath: string,
  sourceFile: ts.SourceFile,
  handleTypeNames: ReadonlySet<string>,
) => {
  const unconverted: string[] = [];

  const resolveQuery = (query: ts.TypeQueryNode) => {
    const name = query.exprName;
    const local = ts.isIdentifier(name) ? name.text : ts.isIdentifier(name.left) ? name.left.text : null;
    const origin = local ? namedImportOf(sourceFile, local) : null;

    if (!origin || origin.namespace === ts.isIdentifier(name)) return;

    const declaringFile = origin.namespace
      ? graph.resolveFile(filePath, origin.specifier)
      : graph.findDeclaringFile(filePath, origin.specifier, origin.imported);

    if (isToolkitActionsFile(tree, declaringFile)) unconverted.push(name.getText(sourceFile));
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isTypeReferenceNode(node) &&
      ts.isIdentifier(node.typeName) &&
      handleTypeNames.has(node.typeName.text) &&
      node.typeArguments
    ) {
      const visitArgument = (inner: ts.Node) => {
        if (ts.isTypeQueryNode(inner)) resolveQuery(inner);

        ts.forEachChild(inner, visitArgument);
      };

      node.typeArguments.forEach(visitArgument);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return unconverted;
};

const isCall = (node: ts.Node, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name;

const readActionId = (node: ts.Expression | undefined, createActionId: string) => {
  if (!node || !isCall(node, createActionId) || node.arguments.length !== 1) return null;

  const inner = node.arguments[0]!;

  if (
    !ts.isCallExpression(inner) ||
    !ts.isPropertyAccessExpression(inner.expression) ||
    !ts.isIdentifier(inner.expression.expression) ||
    inner.expression.name.text !== 'call' ||
    inner.arguments.length !== 1
  ) {
    return null;
  }

  const options = inner.arguments[0]!;

  if (!ts.isObjectLiteralExpression(options) || options.properties.length !== 1) return null;

  const property = options.properties[0]!;

  if (!ts.isPropertyAssignment(property) || property.name.getText() !== 'args') return null;

  return { group: inner.expression.expression.text, args: property.initializer };
};

const selectArgsText = (args: ts.Expression, sourceFile: ts.SourceFile) => {
  if (!ts.isObjectLiteralExpression(args)) return args.getText(sourceFile);

  const kept = args.properties.filter((property) => property.name?.getText(sourceFile) !== 'skipCache');

  if (kept.length === args.properties.length) return args.getText(sourceFile);

  return `{ ${kept.map((property) => property.getText(sourceFile)).join(', ')} }`;
};

const isFacadeSelect = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === 'select' &&
  node.arguments.length === 2 &&
  ts.isIdentifier(node.arguments[0]!) &&
  /facade/i.test(node.expression.expression.getText()) &&
  !/router/i.test(node.expression.expression.getText());

const countIdentifier = (root: ts.Node, name: string) => {
  let count = 0;

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === name) count += 1;

    ts.forEachChild(node, visit);
  };

  visit(root);

  return count;
};

const injectorOf = (classNode: ts.ClassLikeDeclaration) => {
  for (const member of classNode.members) {
    if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.initializer &&
      isCall(member.initializer, 'inject') &&
      member.initializer.arguments[0]?.getText() === 'Injector'
    ) {
      return member.name.text;
    }

    if (ts.isConstructorDeclaration(member)) {
      const parameter = member.parameters.find(
        (candidate) =>
          candidate.type?.getText() === 'Injector' &&
          ts.isIdentifier(candidate.name) &&
          !!ts
            .getModifiers(candidate)
            ?.some((modifier) =>
              [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.PublicKeyword].includes(
                modifier.kind,
              ),
            ),
      );

      if (parameter) return (parameter.name as ts.Identifier).text;
    }
  }

  return null;
};

type RefreshPlan = {
  edits: TextEdit[];
  rewritten: number;
  needsInjectorImport: boolean;
  tasks: ToolkitTaskInput[];
};

const planRefreshSites = (
  filePath: string,
  sourceFile: ts.SourceFile,
  content: string,
  createActionId: string | null,
): RefreshPlan => {
  const plan: RefreshPlan = { edits: [], rewritten: 0, needsInjectorImport: false, tasks: [] };
  const consumedActionIds = new Set<ts.Node>();
  const classInjectors = new Map<ts.ClassLikeDeclaration, string>();

  const task = (node: ts.Node, summary: string) =>
    plan.tasks.push({
      id: CONSUMER_TASK.SELECT_BY_ACTION_ID,
      summary,
      locations: [{ filePath, line: lineOf(sourceFile, node.getStart(sourceFile)) }],
    });

  const injectorFor = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;

    while (current && !ts.isClassLike(current)) current = current.parent;

    if (!current) return null;

    const classNode = current as ts.ClassLikeDeclaration;
    const known = classInjectors.get(classNode) ?? injectorOf(classNode);

    if (known) {
      classInjectors.set(classNode, known);
      return known;
    }

    const taken = classNode.members.some((member) => member.name?.getText(sourceFile) === 'injector');
    const name = taken ? 'toolkitInjector' : 'injector';

    classInjectors.set(classNode, name);
    plan.needsInjectorImport = true;
    plan.edits.push({
      start: classNode.members.pos,
      end: classNode.members.pos,
      text: `\n  private ${name} = inject(Injector);\n`,
    });

    return name;
  };

  const localActionId = (select: ts.CallExpression, identifier: ts.Identifier) => {
    let block: ts.Node | undefined = select.parent;

    while (block && !ts.isBlock(block)) block = block.parent;

    if (!block || !ts.isBlock(block) || countIdentifier(block, identifier.text) !== 2) return null;

    for (const statement of block.statements) {
      if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) continue;

      const declaration = statement.declarationList.declarations[0]!;

      if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier.text) {
        const actionId = createActionId ? readActionId(declaration.initializer, createActionId) : null;

        return actionId ? { ...actionId, statement, initializer: declaration.initializer! } : null;
      }
    }

    return null;
  };

  const visit = (node: ts.Node) => {
    if (isFacadeSelect(node)) {
      const group = (node.arguments[0] as ts.Identifier).text;
      const idArgument = node.arguments[1]!;
      const inline = createActionId ? readActionId(idArgument, createActionId) : null;
      const local = !inline && ts.isIdentifier(idArgument) ? localActionId(node, idArgument) : null;
      const source = inline ?? local;

      if (source && source.group === group) {
        const injector = injectorFor(node);

        if (injector) {
          plan.edits.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            text: `toolkitSelect(${group}, ${selectArgsText(source.args, sourceFile)}, { injector: this.${injector} })`,
          });
          consumedActionIds.add(inline ? idArgument : local!.initializer);

          if (local) plan.edits.push(removeStatement(local.statement, content));

          plan.rewritten += 1;
          return;
        }
      }

      task(
        node,
        `${code(node.getText(sourceFile).replace(/\s+/g, ' '))} looks up a handle by an action id the generator cannot trace to its args.`,
      );
      return;
    }

    ts.forEachChild(node, visit);
  };

  const visitActionIds = (node: ts.Node) => {
    if (createActionId && isCall(node, createActionId) && !consumedActionIds.has(node)) {
      task(
        node,
        `\`${createActionId}(…)\` builds an action id; pass the args on and call \`toolkitSelect\` where the handle is looked up.`,
      );
    }

    ts.forEachChild(node, visitActionIds);
  };

  visit(sourceFile);
  visitActionIds(sourceFile);

  return plan;
};

type ConsumerResult = {
  content: string;
  rewritten: boolean;
  leftOnToolkit: boolean;
  refreshSitesRewritten: number;
  tasks: ToolkitTaskInput[];
};

/** Moves one consumer file from `@tomtomb/ngrx-toolkit` to `@ethlete/query/ngrx-toolkit`. */
export const rewriteConsumer = (
  tree: Tree,
  graph: ModuleGraph,
  filePath: string,
  content: string,
): ConsumerResult | null => {
  const sourceFile = createSourceFile(content, filePath);
  const toolkitImports = toolkitImportsOf(sourceFile);

  if (toolkitImports.length === 0) return null;

  const elements = toolkitImports.flatMap(elementsOf);

  const isInterop = (element: ToolkitImportElement) =>
    INTEROP_SYMBOLS.has(RENAMED_SYMBOLS.get(element.imported) ?? element.imported);

  const hasStoreSide = elements.some((element) => STORE_SIDE_SYMBOLS.has(element.imported));

  if (hasStoreSide && !elements.some(isInterop)) return null;

  const handleTypeNames = new Set(
    elements.filter((element) => HANDLE_TYPES.has(element.imported)).map((element) => element.local),
  );
  const unconverted = unconvertedTypeQueries(tree, graph, filePath, sourceFile, handleTypeNames);

  if (unconverted.length > 0) {
    if (hasStoreSide) return null;

    return {
      content,
      rewritten: false,
      leftOnToolkit: true,
      refreshSitesRewritten: 0,
      tasks: [
        {
          id: CONSUMER_TASK.UNCONVERTED_ACTION_GROUP,
          summary: `${[...new Set(unconverted)].map((name) => `\`${name}\``).join(', ')} still name toolkit action groups.`,
          locations: [{ filePath }],
        },
      ],
    };
  }

  const createActionId = elements.find((element) => element.imported === 'createActionId')?.local ?? null;
  const refresh = planRefreshSites(filePath, sourceFile, content, createActionId);

  let result = applyEdits(content, refresh.edits);

  const rewrittenSource = createSourceFile(result, filePath);
  const used = collectUsedIdentifiers(rewrittenSource);
  const moved: string[] = [];
  const kept: string[] = [];

  for (const element of elements) {
    if (!used.has(element.local)) continue;

    const target = RENAMED_SYMBOLS.get(element.imported) ?? element.imported;
    const binding = target === element.local ? target : `${target} as ${element.local}`;

    if (INTEROP_SYMBOLS.has(target)) {
      moved.push(binding);
    } else {
      kept.push(element.imported === element.local ? element.local : `${element.imported} as ${element.local}`);
    }
  }

  if (refresh.rewritten > 0) moved.push('toolkitSelect');

  const hasInteropImport = rewrittenSource.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === INTEROP_MODULE,
  );
  const replacement = [
    moved.length > 0 && !hasInteropImport ? `import { ${moved.join(', ')} } from '${INTEROP_MODULE}';` : null,
    kept.length > 0 ? `import { ${kept.join(', ')} } from '${TOOLKIT_MODULE}';` : null,
  ].filter((line): line is string => line !== null);

  const importEdits: TextEdit[] = toolkitImportsOf(rewrittenSource).map((statement, index) =>
    index === 0 && replacement.length > 0
      ? { start: statement.getStart(rewrittenSource), end: statement.getEnd(), text: replacement.join('\n') }
      : removeStatement(statement, result),
  );

  result = applyEdits(result, importEdits);

  if (refresh.needsInjectorImport) {
    result = ensureNamedImports({
      content: result,
      importsNeeded: ['inject', 'Injector'],
      moduleSpecifier: '@angular/core',
    });
  }

  if (moved.length > 0 && hasInteropImport) {
    result = ensureNamedImports({ content: result, importsNeeded: moved, moduleSpecifier: INTEROP_MODULE });
  }

  const tasks = [...refresh.tasks];

  if (kept.length > 0) {
    tasks.push({
      id: CONSUMER_TASK.UNSUPPORTED_IMPORT,
      summary: `Still imports ${kept.map((name) => `\`${name}\``).join(', ')} from \`${TOOLKIT_MODULE}\`.`,
      locations: [{ filePath }],
    });
  }

  return {
    content: result,
    rewritten: result !== content,
    leftOnToolkit: kept.length > 0,
    refreshSitesRewritten: refresh.rewritten,
    tasks,
  };
};

const isInterceptor = (node: ts.Node, sourceFile: ts.SourceFile) => {
  if (ts.isClassDeclaration(node)) {
    return !!node.heritageClauses?.some((clause) =>
      clause.types.some((type) => type.expression.getText(sourceFile) === 'HttpInterceptor'),
    );
  }

  if (ts.isVariableDeclaration(node)) return node.type?.getText(sourceFile) === 'HttpInterceptorFn';

  return false;
};

const skippedRequests = (node: ts.Node, sourceFile: ts.SourceFile) => {
  const conditions: string[] = [];
  const prefixes = new Set<string>();

  const visit = (inner: ts.Node) => {
    if (ts.isIfStatement(inner) && /\burl\b/i.test(inner.expression.getText(sourceFile))) {
      const condition = inner.expression.getText(sourceFile).replace(/\s+/g, ' ');

      conditions.push(condition);

      const collectPrefixes = (part: ts.Node) => {
        const text = ts.isStringLiteralLike(part) ? part.text : ts.isTemplateSpan(part) ? part.literal.text : null;
        const prefix = text && /^\/[\w\-/]*/.exec(text)?.[0];

        if (prefix && prefix.length > 1) prefixes.add(prefix);

        ts.forEachChild(part, collectPrefixes);
      };

      collectPrefixes(inner.expression);
    }

    ts.forEachChild(inner, visit);
  };

  visit(node);

  return { conditions, prefixes: [...prefixes] };
};

const findInterceptors = (
  tree: Tree,
  inScope: ReadonlySet<string>,
  filePath: string,
  content: string,
): ToolkitTaskInput[] => {
  if (!/HttpInterceptor/.test(content) || !/authorization|bearer/i.test(content)) return [];

  const sourceFile = createSourceFile(content, filePath);
  const tasks: ToolkitTaskInput[] = [];

  const visit = (node: ts.Node) => {
    if (isInterceptor(node, sourceFile) && /authorization|bearer/i.test(node.getText(sourceFile))) {
      const name = (node as ts.ClassDeclaration | ts.VariableDeclaration).name?.getText(sourceFile) ?? 'interceptor';
      const { conditions, prefixes } = skippedRequests(node, sourceFile);
      const registrations = [...inScope]
        .filter((candidate) => candidate !== filePath && tree.exists(candidate))
        .filter((candidate) => new RegExp(`\\b${name}\\b`).test(tree.read(candidate, 'utf-8') ?? ''))
        .map((candidate) => ({ filePath: candidate }));
      const skipped = conditions.length > 0 ? ` It skips requests where ${conditions.map(code).join('; ')}.` : '';
      const suggestion = prefixes.length > 0 ? ` Candidate \`--publicRoutes=${prefixes.join(',')}\`.` : '';

      tasks.push({
        id: CONSUMER_TASK.AUTH_INTERCEPTOR,
        summary: `\`${name}\` adds an \`Authorization\` header.${skipped}${suggestion}`,
        locations: [{ filePath, line: lineOf(sourceFile, node.getStart(sourceFile)) }, ...registrations],
      });
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return tasks;
};

/** Runs the consumer side of the migration on every scoped file that still imports `@tomtomb/ngrx-toolkit`. */
export const migrateToolkitConsumers = (
  tree: Tree,
  graph: ModuleGraph,
  inScope: ReadonlySet<string>,
  report: ToolkitMigrationReport,
): ToolkitConsumerStats => {
  defineConsumerTasks(report);

  const stats: ToolkitConsumerStats = {
    filesRewritten: 0,
    filesLeftOnToolkit: 0,
    refreshSitesRewritten: 0,
    interceptorsFound: 0,
  };

  for (const filePath of inScope) {
    if (filePath.endsWith('.d.ts')) continue;

    const content = tree.read(filePath, 'utf-8');

    if (!content) continue;

    const interceptors = findInterceptors(tree, inScope, filePath, content);

    interceptors.forEach((task) => report.add(task));
    stats.interceptorsFound += interceptors.length;

    if (!content.includes(TOOLKIT_MODULE)) continue;

    const result = rewriteConsumer(tree, graph, filePath, content);

    if (!result) continue;

    result.tasks.forEach((task) => report.add(task));

    if (result.rewritten) {
      tree.write(filePath, result.content);
      stats.filesRewritten += 1;
    }

    if (result.leftOnToolkit) stats.filesLeftOnToolkit += 1;

    stats.refreshSitesRewritten += result.refreshSitesRewritten;
  }

  return stats;
};
