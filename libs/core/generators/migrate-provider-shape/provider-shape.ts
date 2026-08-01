import * as ts from 'typescript';

/**
 * `export const [provideX, injectX] = createRootProvider(…)` is undroppable by construction: array
 * destructuring invokes the iterator protocol, so no bundler will remove the statement, and everything
 * the factory's closure names is retained with it. The definition shape is droppable per binding.
 *
 * Two families need rewriting. The `create*Provider` / `createLabels` helpers were replaced by
 * `define*`, and their declarations take a pure annotation because they sit in library source. The
 * runtime factories below kept their names — only their return shape changed from tuple to definition —
 * and their call sites are application code, where an annotation would be noise.
 */
const FACTORY_TO_DEFINE: Record<string, string> = {
  createProvider: 'defineProvider',
  createRootProvider: 'defineRootProvider',
  createStaticProvider: 'defineStaticProvider',
  createStaticRootProvider: 'defineStaticRootProvider',
  createLabels: 'defineLabels',
};

const REF_FACTORIES = new Set([
  'createQueryClient',
  'createBearerAuthProvider',
  'createWebSocketClient',
  'createQueryContext',
]);

const isKnownFactory = (name: string) => FACTORY_TO_DEFINE[name] !== undefined || REF_FACTORIES.has(name);

/** Which extractor names the three tuple positions become. */
const POSITION_TO_EXTRACTOR = ['toProvideFn', 'toInjectFn', 'toToken'];

const PURE = '/* @__PURE__ */';

export type ProviderShapeTask = {
  /** Stable id, so a re-run reports the same task for the same site. */
  id: string;
  file: string;
  line: number;
  message: string;
};

export type ProviderShapeResult = {
  content: string;
  changed: boolean;
  /** Sites the codemod deliberately left alone, for the migration-tasks file. */
  tasks: ProviderShapeTask[];
};

/** `injectFooBar` / `provideFooBar` / `FOO_BAR_TOKEN` → `FOO_BAR`. */
const toDefinitionBaseName = (bindingName: string): string => {
  const withoutPrefix = bindingName
    .replace(/^ɵ/, '')
    .replace(/^(provide|inject)/i, '')
    .replace(/_TOKEN$/, '');

  const screaming = withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();

  return screaming.replace(/^_+|_+$/g, '') || 'PROVIDER';
};

const uniqueDefinitionName = (bindingNames: string[], taken: Set<string>): string => {
  const base = `${toDefinitionBaseName(bindingNames[1] ?? bindingNames[0] ?? bindingNames[2] ?? 'provider')}_DEF`;

  let candidate = base;
  let suffix = 2;

  while (taken.has(candidate)) {
    candidate = `${base}_${suffix++}`;
  }

  taken.add(candidate);

  return candidate;
};

type TupleSite = {
  statement: ts.VariableStatement;
  call: ts.CallExpression;
  factory: string;
  /** `null` for an omitted element (`const [, injectX] = …`). */
  bindings: (string | null)[];
  isExported: boolean;
};

const findTupleSites = (sourceFile: ts.SourceFile): TupleSite[] => {
  const sites: TupleSite[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) continue;

    const declaration = statement.declarationList.declarations[0];
    if (!declaration || !ts.isArrayBindingPattern(declaration.name)) continue;

    const call = declaration.initializer;
    if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) continue;

    const factory = call.expression.text;
    if (!isKnownFactory(factory)) continue;

    const bindings = declaration.name.elements.map((element) => {
      if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) return null;

      return element.name.text;
    });

    sites.push({
      statement,
      call,
      factory,
      bindings,
      isExported: !!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    });
  }

  return sites;
};

/** The offset the replacement starts at: before the declaration's own JSDoc, if it has one. */
const declarationStart = (content: string, statement: ts.Statement, sourceFile: ts.SourceFile): number => {
  const start = statement.getStart(sourceFile);
  const comments = ts.getLeadingCommentRanges(content, statement.getFullStart());
  const first = comments?.[0];

  // Only treat comments as the declaration's own when nothing but whitespace separates them from it.
  if (!first || /\S/.test(content.slice(comments[comments.length - 1]!.end, start))) return start;

  return first.pos;
};

const rewriteSite = (
  content: string,
  sourceFile: ts.SourceFile,
  site: TupleSite,
  definitionName: string,
): { start: number; end: number; text: string } => {
  const start = declarationStart(content, site.statement, sourceFile);
  const statementStart = site.statement.getStart(sourceFile);
  const doc = content.slice(start, statementStart);

  const replacement = FACTORY_TO_DEFINE[site.factory];
  const annotation = replacement ? `${PURE} ` : '';
  const callTail = content.slice(site.call.expression.getEnd(), site.call.getEnd());
  const definition = `const ${definitionName} = ${annotation}${replacement ?? site.factory}${callTail};`;

  const exportKeyword = site.isExported ? 'export ' : '';
  const extractions = site.bindings
    .map((binding, index) =>
      binding === null
        ? null
        : `${exportKeyword}const ${binding} = ${annotation}${POSITION_TO_EXTRACTOR[index]}(${definitionName});`,
    )
    .filter((line): line is string => line !== null);

  // The JSDoc documented the pair, so it belongs on the first binding a consumer can reach.
  const documented =
    extractions.length > 0 ? [definition, '', doc + extractions[0], ...extractions.slice(1)] : [doc + definition];

  return { start, end: site.statement.getEnd(), text: documented.join('\n') };
};

type ImportRewrite = { start: number; end: number; text: string };

const rewriteImports = (
  content: string,
  sourceFile: ts.SourceFile,
  factoriesUsed: Set<string>,
  extractorsUsed: Set<string>,
): ImportRewrite[] => {
  const rewrites: ImportRewrite[] = [];
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);

  /** The declaration the extractors join: the one that already provides them, else any core import. */
  const extractorHost =
    imports.find((statement) => namedImportsOf(statement, sourceFile)?.some((name) => extractorsUsed.has(name))) ??
    imports.find((statement) => {
      const names = namedImportsOf(statement, sourceFile);

      return names?.some((name) => FACTORY_TO_DEFINE[name] !== undefined) || isCoreImport(statement);
    });

  for (const statement of imports) {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    const names = bindings.elements.map((element) => element.getText(sourceFile));
    // A ref factory keeps its name and its import; only a replaced factory is swapped out.
    const replaced = names.filter((name) => factoriesUsed.has(name) && FACTORY_TO_DEFINE[name] !== undefined);
    const extractors = statement === extractorHost ? [...extractorsUsed] : [];

    if (replaced.length === 0 && extractors.length === 0) continue;

    const kept = names.filter((name) => !replaced.includes(name));
    const merged = [
      ...new Set([...kept, ...replaced.map((factory) => FACTORY_TO_DEFINE[factory]!), ...extractors]),
    ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    rewrites.push({
      start: bindings.getStart(sourceFile),
      end: bindings.getEnd(),
      text: `{ ${merged.join(', ')} }`,
    });
  }

  if (extractorHost) return rewrites;

  // Nothing to join — the file only imported a ref factory from another package, so add a core import.
  const anchor = imports[imports.length - 1];
  const position = anchor ? anchor.getEnd() : 0;
  const statement = `import { ${[...extractorsUsed].sort().join(', ')} } from '@ethlete/core';`;

  rewrites.push({ start: position, end: position, text: anchor ? `\n${statement}` : `${statement}\n` });

  return rewrites;
};

const namedImportsOf = (statement: ts.ImportDeclaration, sourceFile: ts.SourceFile) => {
  const bindings = statement.importClause?.namedBindings;

  if (!bindings || !ts.isNamedImports(bindings)) return undefined;

  return bindings.elements.map((element) => element.getText(sourceFile));
};

const isCoreImport = (statement: ts.ImportDeclaration) =>
  ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === '@ethlete/core';

/**
 * Rewrites every top-level destructured provider tuple in one file into a descriptor plus one pure
 * extractor per exported binding. Returns the file unchanged when there is nothing to do.
 */
export const migrateProviderShapeInFile = (filePath: string, content: string): ProviderShapeResult => {
  if (![...Object.keys(FACTORY_TO_DEFINE), ...REF_FACTORIES].some((factory) => content.includes(factory))) {
    return { content, changed: false, tasks: [] };
  }

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const sites = findTupleSites(sourceFile);
  const tasks = collectTasks(filePath, sourceFile, sites);

  if (sites.length === 0) return { content, changed: false, tasks };

  const taken = new Set<string>(
    sourceFile.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => statement.declarationList.declarations)
      .flatMap((declaration) => (ts.isIdentifier(declaration.name) ? [declaration.name.text] : [])),
  );

  const factoriesUsed = new Set(sites.map((site) => site.factory));
  const extractorsUsed = new Set(
    sites.flatMap((site) =>
      site.bindings.flatMap((binding, index) => (binding === null ? [] : [POSITION_TO_EXTRACTOR[index]!])),
    ),
  );

  const edits = [
    ...sites.map((site) =>
      rewriteSite(
        content,
        sourceFile,
        site,
        uniqueDefinitionName(
          site.bindings.filter((b): b is string => b !== null),
          taken,
        ),
      ),
    ),
    ...rewriteImports(content, sourceFile, factoriesUsed, extractorsUsed),
  ].sort((a, b) => b.start - a.start);

  let updated = content;
  for (const edit of edits) {
    updated = updated.slice(0, edit.start) + edit.text + updated.slice(edit.end);
  }

  return { content: updated, changed: updated !== content, tasks };
};

/** Call sites the codemod cannot safely rewrite — a factory result that is not a plain tuple binding. */
const collectTasks = (filePath: string, sourceFile: ts.SourceFile, sites: TupleSite[]): ProviderShapeTask[] => {
  const rewritten = new Set(sites.map((site) => site.statement));
  const tasks: ProviderShapeTask[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && isKnownFactory(node.expression.text)) {
      const statement = enclosingStatement(node);

      if (!statement || !rewritten.has(statement as ts.VariableStatement)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const factory = node.expression.text;

        const replacement = FACTORY_TO_DEFINE[factory];

        tasks.push({
          id: `provider-shape:${filePath}:${line + 1}`,
          file: filePath,
          line: line + 1,
          message: replacement
            ? `\`${factory}\` is gone. Replace it with \`${replacement}\` and read the halves with \`toProvideFn\` / \`toInjectFn\` / \`toToken\`.`
            : `\`${factory}\` returns a provider definition now, not a \`[provide, inject, token]\` tuple. Read the halves with \`toProvideFn\` / \`toInjectFn\` / \`toToken\`, or \`.provide\` / \`.inject\` / \`.token\` inside a function.`,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return tasks;
};

const enclosingStatement = (node: ts.Node): ts.Statement | undefined => {
  let current: ts.Node | undefined = node;

  while (current && !ts.isSourceFile(current)) {
    if (ts.isVariableStatement(current)) return current;
    current = current.parent;
  }

  return undefined;
};
