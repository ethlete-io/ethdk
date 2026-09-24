import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { createSourceFile } from '../migrate-to-query-v3/shared.js';
import { ToolkitFeature } from './feature.js';
import { TOOLKIT_TASK, ToolkitMigrationReport, ToolkitTaskLocation } from './report.js';
import {
  TextEdit,
  applyEdits,
  collapseBlankLines,
  declaredNames,
  lineOf,
  pruneUnusedImports,
  relativeSpecifier,
  removeStatement,
} from './ts-edits.js';

const MAX_CASCADE_ROUNDS = 6;

const FEATURE_REGISTRATIONS = new Set(['StoreModule.forFeature', 'provideState']);
const EFFECTS_REGISTRATIONS = new Set(['EffectsModule.forFeature', 'provideEffects']);

type Status = 'deleted' | 'moved' | null;

type Reference = {
  file: string;
  sourceFile: ts.SourceFile;
  declaringFile: string;
  symbol: string;
  line: number;
  /** The list element to remove, or `null` when the reference cannot be rewritten. */
  target: ts.Node | null;
};

type SpecifierRewrite = {
  file: string;
  sourceFile: ts.SourceFile;
  literal: ts.StringLiteral;
  to: string;
};

type ScanResult = {
  references: Reference[];
  rewrites: SpecifierRewrite[];
};

type ScanOptions = {
  statusOf: (declaringFile: string, symbol: string) => Status;
  /** Files whose own references do not count, because they are deleted with the symbols. */
  skipFiles: ReadonlySet<string>;
  /** Top-level names in a file that are deleted along with their declarations. */
  localSymbols: ReadonlyMap<string, ReadonlySet<string>>;
  /** Source ranges inside which references do not count. */
  skipRanges: ReadonlyMap<string, ReadonlyArray<readonly [number, number]>>;
  /** Files whose `export … from` of them must be rewritten (barrels). */
  deletedFiles: ReadonlySet<string>;
  /** Deleted actions files and the queries file that replaces them. */
  movedFiles: ReadonlyMap<string, string>;
  /** Strings a file has to contain to be worth parsing. */
  needles: readonly string[];
};

export type StoreRemovalResult = {
  deletedFiles: string[];
  keptFeatures: ToolkitFeature[];
};

const calleeText = (call: ts.CallExpression) => call.expression.getText().replace(/\s+/g, '');

const isDeclarationName = (node: ts.Identifier) => {
  const parent = node.parent;

  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isBindingElement(parent) ||
      ts.isEnumMember(parent) ||
      ts.isGetAccessor(parent) ||
      ts.isSetAccessor(parent)) &&
    parent.name === node
  ) {
    return true;
  }

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;

  return false;
};

const listOf = (node: ts.Node): ts.NodeArray<ts.Node> | null => {
  const parent = node.parent;

  if (ts.isArrayLiteralExpression(parent)) return parent.elements;
  if (ts.isObjectLiteralExpression(parent)) return parent.properties;
  if (ts.isCallExpression(parent) && parent.arguments.includes(node as ts.Expression)) return parent.arguments;
  if (ts.isHeritageClause(parent)) return parent.types;
  if (ts.isNamedExports(parent)) return parent.elements;
  if (ts.isIntersectionTypeNode(parent)) return parent.types;

  return null;
};

const EMPTY_STATE_TYPE = 'Record<string, never>';

/** A registration call (`StoreModule.forFeature(…)`) can only go if it sits in an `imports` or providers list. */
const registrationTarget = (call: ts.CallExpression): ts.Node | null => {
  const parent = call.parent;

  if (ts.isArrayLiteralExpression(parent)) return call;
  if (ts.isCallExpression(parent) && calleeText(parent) === 'importProvidersFrom') return call;

  return null;
};

const classify = (reference: ts.Node, isDeletedExpression: (expression: ts.Expression) => boolean): ts.Node | null => {
  const parent = reference.parent;

  if (ts.isTypeReferenceNode(parent) && parent.typeName === reference) {
    const owner = parent.parent;

    if (parent.typeArguments) return null;
    if (ts.isIntersectionTypeNode(owner)) return parent;
    if (ts.isTypeAliasDeclaration(owner) && owner.type === parent) return parent;

    return null;
  }

  if (ts.isCallExpression(parent) && parent.arguments.includes(reference as ts.Expression)) {
    const callee = calleeText(parent);

    if (FEATURE_REGISTRATIONS.has(callee) || EFFECTS_REGISTRATIONS.has(callee)) return registrationTarget(parent);
    if (callee === 'importProvidersFrom') return reference;

    return null;
  }

  if (ts.isArrayLiteralExpression(parent)) {
    const owner = parent.parent;

    if (
      ts.isCallExpression(owner) &&
      EFFECTS_REGISTRATIONS.has(calleeText(owner)) &&
      parent.elements.every((element) => isDeletedExpression(element))
    ) {
      return registrationTarget(owner);
    }

    return reference;
  }

  if (ts.isComputedPropertyName(parent) && ts.isPropertyAssignment(parent.parent)) return parent.parent;
  if (ts.isPropertyAssignment(parent) && parent.initializer === reference) return parent;
  if (ts.isShorthandPropertyAssignment(parent)) return parent;
  if (ts.isExpressionWithTypeArguments(parent) && ts.isHeritageClause(parent.parent)) return parent;
  if (ts.isExportSpecifier(parent)) return parent;

  return null;
};

const scanReferences = (tree: Tree, graph: ModuleGraph, inScope: ReadonlySet<string>, options: ScanOptions) => {
  const result: ScanResult = { references: [], rewrites: [] };

  visitNotIgnoredFiles(tree, '', (file) => {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts') || options.skipFiles.has(file)) return;

    const content = tree.read(file, 'utf-8');
    const locals = options.localSymbols.get(file);

    if (!content || (!locals && !options.needles.some((needle) => content.includes(needle)))) return;

    const sourceFile = createSourceFile(content, file);
    const ranges = options.skipRanges.get(file) ?? [];
    const named = new Map<string, { specifier: string; imported: string }>();
    const namespaces = new Map<string, string>();
    const editable = inScope.has(file);

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

      const specifier = statement.moduleSpecifier.text;
      const bindings = statement.importClause?.namedBindings;

      if (bindings && ts.isNamespaceImport(bindings)) namespaces.set(bindings.name.text, specifier);

      if (bindings && ts.isNamedImports(bindings)) {
        bindings.elements.forEach((element) =>
          named.set(element.name.text, { specifier, imported: element.propertyName?.text ?? element.name.text }),
        );
      }

      const resolved = graph.resolveFile(file, specifier);
      const movedTo = resolved ? options.movedFiles.get(resolved) : undefined;

      if (movedTo) {
        result.rewrites.push({
          file,
          sourceFile,
          literal: statement.moduleSpecifier,
          to: relativeSpecifier(file, movedTo),
        });
      }
    }

    const statusOfExpression = (
      expression: ts.Node,
    ): { status: Status; declaringFile: string; symbol: string } | null => {
      if (ts.isIdentifier(expression)) {
        const imported = named.get(expression.text);

        if (imported) {
          const declaringFile = graph.findDeclaringFile(file, imported.specifier, imported.imported);

          return declaringFile
            ? { status: options.statusOf(declaringFile, imported.imported), declaringFile, symbol: imported.imported }
            : null;
        }

        if (locals?.has(expression.text) && !isDeclarationName(expression)) {
          return { status: 'deleted', declaringFile: file, symbol: expression.text };
        }

        return null;
      }

      if (
        (ts.isPropertyAccessExpression(expression) || ts.isQualifiedName(expression)) &&
        ts.isIdentifier(ts.isPropertyAccessExpression(expression) ? expression.expression : expression.left)
      ) {
        const left = ts.isPropertyAccessExpression(expression) ? expression.expression : expression.left;
        const right = ts.isPropertyAccessExpression(expression) ? expression.name : expression.right;
        const specifier = namespaces.get((left as ts.Identifier).text);

        if (!specifier) return null;

        const declaringFile = graph.findDeclaringFile(file, specifier, right.text);

        return declaringFile
          ? { status: options.statusOf(declaringFile, right.text), declaringFile, symbol: right.text }
          : null;
      }

      return null;
    };

    const isDeletedExpression = (expression: ts.Expression) => statusOfExpression(expression)?.status === 'deleted';

    const record = (node: ts.Node, declaringFile: string, symbol: string) => {
      const start = node.getStart(sourceFile);

      if (ranges.some(([from, to]) => start >= from && start < to)) return;

      result.references.push({
        file,
        sourceFile,
        declaringFile,
        symbol,
        line: lineOf(sourceFile, start),
        target: editable ? classify(node, isDeletedExpression) : null,
      });
    };

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) return;

      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const resolved = graph.resolveFile(file, node.moduleSpecifier.text);

        if (resolved && options.deletedFiles.has(resolved) && !editable) {
          result.references.push({
            file,
            sourceFile,
            declaringFile: resolved,
            symbol: '*',
            line: lineOf(sourceFile, node.getStart(sourceFile)),
            target: null,
          });
        }

        return;
      }

      if (
        ts.isPropertyAccessExpression(node) ||
        ts.isQualifiedName(node) ||
        (ts.isIdentifier(node) && !isDeclarationName(node) && !ts.isExportSpecifier(node.parent))
      ) {
        const status = statusOfExpression(node);

        if (status?.status === 'deleted') {
          record(node, status.declaringFile, status.symbol);
          return;
        }

        if (status) return;
      }

      if (ts.isExportSpecifier(node) && !node.parent.parent.moduleSpecifier) {
        const local = node.propertyName ?? node.name;
        const status = ts.isIdentifier(local) ? statusOfExpression(local) : null;

        if (status?.status === 'deleted') {
          record(local, status.declaringFile, status.symbol);
          return;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  });

  return result;
};

const indentationAt = (content: string, position: number) => {
  let lineStart = position;

  while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart -= 1;

  return /^[ \t]*/.exec(content.slice(lineStart))![0];
};

/** One edit per list that loses elements; a list left empty in a heritage clause or export takes its owner with it. */
const listRemovalEdits = (content: string, sourceFile: ts.SourceFile, targets: readonly ts.Node[]) => {
  const byList = new Map<ts.NodeArray<ts.Node>, Set<ts.Node>>();

  const edits: TextEdit[] = [];

  for (const target of targets) {
    const list = listOf(target);

    if (!list && ts.isTypeAliasDeclaration(target.parent)) {
      edits.push({ start: target.getStart(sourceFile), end: target.getEnd(), text: EMPTY_STATE_TYPE });
      continue;
    }

    if (!list) continue;

    const removed = byList.get(list) ?? new Set<ts.Node>();

    removed.add(target);
    byList.set(list, removed);
  }

  for (const [list, removed] of byList) {
    const kept = list.filter((node) => !removed.has(node));
    const owner = list[0]!.parent;

    if (ts.isIntersectionTypeNode(owner)) {
      edits.push({
        start: owner.getStart(sourceFile),
        end: owner.getEnd(),
        text: kept.length > 0 ? kept.map((node) => node.getText(sourceFile)).join(' & ') : EMPTY_STATE_TYPE,
      });
      continue;
    }

    if (kept.length === 0 && ts.isHeritageClause(owner)) {
      edits.push({ start: owner.getFullStart(), end: owner.getEnd(), text: '' });
      continue;
    }

    if (kept.length === 0 && ts.isNamedExports(owner)) {
      edits.push(removeStatement(owner.parent, content));
      continue;
    }

    if (kept.length === 0) {
      let end = list.end;

      while (/\s/.test(content[end] ?? '')) end += 1;

      edits.push({ start: list.pos, end: content[end] === ',' ? end + 1 : list.end, text: '' });
      continue;
    }

    const first = list[0]!.getStart(sourceFile);
    const multiline = content.slice(first, list[list.length - 1]!.getEnd()).includes('\n');
    const separator = multiline ? `,\n${indentationAt(content, first)}` : ', ';

    edits.push({
      start: first,
      end: list[list.length - 1]!.getEnd(),
      text: kept.map((node) => node.getText(sourceFile)).join(separator),
    });
  }

  return edits;
};

const EMPTY_INITIALIZER = /^(\{\s*\}|\[\s*\])$/;

const ngModuleConfig = (declaration: ts.ClassDeclaration) => {
  const decorator = ts
    .getDecorators(declaration)
    ?.find(
      (candidate) =>
        ts.isCallExpression(candidate.expression) && candidate.expression.expression.getText() === 'NgModule',
    );
  const argument =
    decorator && ts.isCallExpression(decorator.expression) ? decorator.expression.arguments[0] : undefined;

  return argument && ts.isObjectLiteralExpression(argument) ? argument : null;
};

const isTrivialNgModule = (declaration: ts.ClassDeclaration) => {
  const config = ngModuleConfig(declaration);

  if (!config || declaration.members.length > 0) return false;

  return config.properties.every((property) => {
    if (!ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) return false;

    return property.initializer.elements.every((element) => element.getText() === 'CommonModule');
  });
};

type Emptiable = { kind: 'value' | 'interface' | 'module'; statement: ts.Statement; sourceFile: ts.SourceFile };

const emptiableDeclarations = (sourceFile: ts.SourceFile) => {
  const found = new Map<string, Emptiable>();

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
      const declaration = statement.declarationList.declarations[0]!;
      const initializer = declaration.initializer;

      if (
        ts.isIdentifier(declaration.name) &&
        initializer &&
        (ts.isObjectLiteralExpression(initializer) || ts.isArrayLiteralExpression(initializer))
      ) {
        found.set(declaration.name.text, { kind: 'value', statement, sourceFile });
      }
    }

    if (ts.isInterfaceDeclaration(statement) && statement.heritageClauses?.length) {
      found.set(statement.name.text, { kind: 'interface', statement, sourceFile });
    }

    if (ts.isClassDeclaration(statement) && statement.name && ngModuleConfig(statement)) {
      found.set(statement.name.text, { kind: 'module', statement, sourceFile });
    }
  }

  return found;
};

const isEmptied = (candidate: Emptiable) => {
  const { statement, sourceFile } = candidate;

  if (candidate.kind === 'value' && ts.isVariableStatement(statement)) {
    return EMPTY_INITIALIZER.test(statement.declarationList.declarations[0]!.initializer!.getText(sourceFile));
  }

  if (candidate.kind === 'interface' && ts.isInterfaceDeclaration(statement)) {
    return !statement.heritageClauses?.length && statement.members.length === 0;
  }

  return ts.isClassDeclaration(statement) && isTrivialNgModule(statement);
};

const hasOnlyImports = (content: string) =>
  createSourceFile(content).statements.every((statement) => ts.isImportDeclaration(statement));

/**
 * Deletes the store files of converted features and unhooks them: the domain `ActionReducerMap`, effect lists,
 * `StoreModule.forFeature` / `EffectsModule.forFeature` registrations, and barrels. A feature whose store files are
 * still used somewhere this cannot rewrite keeps them, and gets a task.
 */
export const removeFeatureStores = (
  tree: Tree,
  graph: ModuleGraph,
  inScope: ReadonlySet<string>,
  features: readonly ToolkitFeature[],
  report: ToolkitMigrationReport,
): StoreRemovalResult => {
  const storeFilesOf = (feature: ToolkitFeature) =>
    [
      feature.files.actions,
      feature.files.reducer,
      feature.files.effects,
      feature.files.selectors,
      feature.files.service,
    ].filter((file): file is string => !!file);

  const movedNames = new Map<string, Set<string>>(
    features.map((feature) => [feature.files.actions, new Set(feature.calls.map((call) => call.name))]),
  );

  const featureOfFile = new Map<string, ToolkitFeature>();

  features.forEach((feature) => storeFilesOf(feature).forEach((file) => featureOfFile.set(file, feature)));

  const declaredIn = (file: string) => {
    const content = tree.read(file, 'utf-8');

    return content ? createSourceFile(content, file).statements.flatMap(declaredNames) : [];
  };

  let converting = new Set(features);
  let scan: ScanResult;
  const keptLocations = new Map<ToolkitFeature, ToolkitTaskLocation[]>();

  for (;;) {
    const deletedFiles = new Set([...converting].flatMap(storeFilesOf));
    const movedFiles = new Map([...converting].map((feature) => [feature.files.actions, feature.queriesFile]));
    const needles = [
      ...new Set(
        [...deletedFiles].flatMap((file) => [...declaredIn(file), file.split('/').pop()!.replace(/\.ts$/, '')]),
      ),
    ];

    scan = scanReferences(tree, graph, inScope, {
      statusOf: (declaringFile, symbol) => {
        if (!deletedFiles.has(declaringFile)) return null;

        return movedFiles.has(declaringFile) && movedNames.get(declaringFile)?.has(symbol) ? 'moved' : 'deleted';
      },
      skipFiles: deletedFiles,
      localSymbols: new Map(),
      skipRanges: new Map(),
      deletedFiles,
      movedFiles,
      needles,
    });

    const blocked = new Set<ToolkitFeature>();

    for (const reference of scan.references) {
      const feature = featureOfFile.get(reference.declaringFile);

      if (!feature || reference.target || !converting.has(feature)) continue;

      blocked.add(feature);
      keptLocations.set(feature, [
        ...(keptLocations.get(feature) ?? []),
        { filePath: reference.file, line: reference.line },
      ]);
    }

    if (blocked.size === 0) break;

    converting = new Set([...converting].filter((feature) => !blocked.has(feature)));
  }

  for (const [feature, locations] of keptLocations) {
    if (converting.has(feature)) continue;

    report.add({
      id: TOOLKIT_TASK.STORE_FILE_KEPT,
      summary: `The store files of \`${feature.base}\` (${feature.dir}) are still used.`,
      locations: [{ filePath: feature.files.actions }, ...locations],
    });
  }

  const deletedFiles = new Set([...converting].flatMap(storeFilesOf));
  const movedFiles = new Map([...converting].map((feature) => [feature.files.actions, feature.queriesFile]));
  const editedFiles = new Set<string>();

  const applyScan = (result: ScanResult, extraEdits: Map<string, TextEdit[]>) => {
    const byFile = new Map<string, { sourceFile: ts.SourceFile; targets: ts.Node[]; edits: TextEdit[] }>();

    const entry = (file: string, sourceFile: ts.SourceFile) => {
      const existing = byFile.get(file) ?? { sourceFile, targets: [], edits: [] };

      byFile.set(file, existing);

      return existing;
    };

    result.references.forEach((reference) => {
      if (reference.target) entry(reference.file, reference.sourceFile).targets.push(reference.target);
    });
    result.rewrites.forEach((rewrite) =>
      entry(rewrite.file, rewrite.sourceFile).edits.push({
        start: rewrite.literal.getStart(rewrite.sourceFile),
        end: rewrite.literal.getEnd(),
        text: `'${rewrite.to}'`,
      }),
    );

    const snapshots = new Map<string, Map<string, Emptiable>>();

    for (const [file, { sourceFile, targets, edits }] of byFile) {
      const content = sourceFile.text;

      snapshots.set(file, emptiableDeclarations(sourceFile));

      const next = applyEdits(content, [
        ...listRemovalEdits(content, sourceFile, targets),
        ...edits,
        ...(extraEdits.get(file) ?? []),
      ]);

      tree.write(file, next);
      editedFiles.add(file);
    }

    for (const [file, edits] of extraEdits) {
      if (byFile.has(file)) continue;

      const content = tree.read(file, 'utf-8')!;

      snapshots.set(file, emptiableDeclarations(createSourceFile(content, file)));
      tree.write(file, applyEdits(content, edits));
      editedFiles.add(file);
    }

    return snapshots;
  };

  let snapshots = applyScan(scan, new Map());

  for (let round = 0; round < MAX_CASCADE_ROUNDS; round += 1) {
    let candidates = new Map<string, Map<string, Emptiable>>();

    for (const [file, before] of snapshots) {
      const sourceFile = createSourceFile(tree.read(file, 'utf-8')!, file);
      const after = emptiableDeclarations(sourceFile);
      const emptied = new Map<string, Emptiable>();

      for (const [name, candidate] of after) {
        const previous = before.get(name);

        if (previous && !isEmptied(previous) && isEmptied(candidate)) {
          emptied.set(name, candidate);
        }
      }

      if (emptied.size > 0) candidates.set(file, emptied);
    }

    if (candidates.size === 0) break;

    let cascadeScan: ScanResult;

    for (;;) {
      const current = candidates;

      cascadeScan = scanReferences(tree, graph, inScope, {
        statusOf: (declaringFile, symbol) => (current.get(declaringFile)?.has(symbol) ? 'deleted' : null),
        skipFiles: deletedFiles,
        localSymbols: new Map([...current].map(([file, names]) => [file, new Set(names.keys())])),
        skipRanges: new Map(
          [...current].map(([file, names]) => [
            file,
            [...names.values()].map(({ statement }) => [statement.getFullStart(), statement.getEnd()] as const),
          ]),
        ),
        deletedFiles: new Set(),
        movedFiles: new Map(),
        needles: [...new Set([...current.values()].flatMap((names) => [...names.keys()]))],
      });

      const blocked = new Set(
        cascadeScan.references
          .filter((reference) => !reference.target)
          .map((reference) => `${reference.declaringFile}#${reference.symbol}`),
      );

      if (blocked.size === 0) break;

      const next = new Map<string, Map<string, Emptiable>>();

      for (const [file, names] of current) {
        const kept = new Map([...names].filter(([name]) => !blocked.has(`${file}#${name}`)));

        if (kept.size > 0) next.set(file, kept);
      }

      candidates = next;

      if (candidates.size === 0) break;
    }

    if (candidates.size === 0) break;

    const declarationEdits = new Map<string, TextEdit[]>();

    for (const [file, names] of candidates) {
      const content = tree.read(file, 'utf-8')!;

      declarationEdits.set(
        file,
        [...names.values()].map(({ statement }) => removeStatement(statement, content)),
      );
    }

    snapshots = applyScan(
      {
        references: cascadeScan.references.filter((reference) =>
          candidates.get(reference.declaringFile)?.has(reference.symbol),
        ),
        rewrites: [],
      },
      declarationEdits,
    );
  }

  removeOrphanedStateDeclarations(tree, graph, inScope, editedFiles, deletedFiles);

  for (const file of editedFiles) {
    if (deletedFiles.has(file) || !tree.exists(file)) continue;

    tree.write(file, collapseBlankLines(pruneUnusedImports(tree.read(file, 'utf-8')!)));
  }

  const emptiedFiles = [...editedFiles].filter(
    (file) => !deletedFiles.has(file) && tree.exists(file) && hasOnlyImports(tree.read(file, 'utf-8')!),
  );

  emptiedFiles.forEach((file) => deletedFiles.add(file));

  rewriteBarrels(tree, graph, inScope, deletedFiles, movedFiles, movedNames);

  for (const file of deletedFiles) {
    if (tree.exists(file)) tree.delete(file);
  }

  return {
    deletedFiles: [...deletedFiles].sort(),
    keptFeatures: features.filter((feature) => !converting.has(feature)),
  };
};

const isOrphanCandidate = (statement: ts.Statement, sourceFile: ts.SourceFile) => {
  if (ts.isInterfaceDeclaration(statement)) return !statement.heritageClauses?.length && statement.members.length === 0;
  if (ts.isTypeAliasDeclaration(statement)) return statement.type.getText(sourceFile) === EMPTY_STATE_TYPE;
  if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) return false;

  const declaration = statement.declarationList.declarations[0]!;
  const initializer = declaration.initializer;

  if (!initializer || !ts.isIdentifier(declaration.name)) return false;

  if (ts.isStringLiteral(initializer)) return /FEATURE_KEY$/.test(declaration.name.text);

  return (
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === 'createFeatureSelector'
  );
};

/** Drops the feature selector, feature key and state type a domain index keeps once its last feature is gone. */
const removeOrphanedStateDeclarations = (
  tree: Tree,
  graph: ModuleGraph,
  inScope: ReadonlySet<string>,
  editedFiles: ReadonlySet<string>,
  deletedFiles: ReadonlySet<string>,
) => {
  let candidates = new Map<string, Map<string, ts.Statement>>();

  for (const file of editedFiles) {
    if (deletedFiles.has(file) || !tree.exists(file)) continue;

    const sourceFile = createSourceFile(tree.read(file, 'utf-8')!, file);
    const found = new Map<string, ts.Statement>();

    for (const statement of sourceFile.statements) {
      if (isOrphanCandidate(statement, sourceFile))
        declaredNames(statement).forEach((name) => found.set(name, statement));
    }

    if (found.size > 0) candidates.set(file, found);
  }

  while (candidates.size > 0) {
    const current = candidates;
    const scan = scanReferences(tree, graph, inScope, {
      statusOf: (declaringFile, symbol) => (current.get(declaringFile)?.has(symbol) ? 'deleted' : null),
      skipFiles: deletedFiles,
      localSymbols: new Map([...current].map(([file, names]) => [file, new Set(names.keys())])),
      skipRanges: new Map(
        [...current].map(([file, names]) => [
          file,
          [...names.values()].map((statement) => [statement.getFullStart(), statement.getEnd()] as const),
        ]),
      ),
      deletedFiles: new Set(),
      movedFiles: new Map(),
      needles: [...new Set([...current.values()].flatMap((names) => [...names.keys()]))],
    });
    const referenced = new Set(scan.references.map((reference) => `${reference.declaringFile}#${reference.symbol}`));

    if (referenced.size === 0) break;

    const next = new Map<string, Map<string, ts.Statement>>();

    for (const [file, names] of current) {
      const kept = new Map([...names].filter(([name]) => !referenced.has(`${file}#${name}`)));

      if (kept.size > 0) next.set(file, kept);
    }

    candidates = next;
  }

  for (const [file, names] of candidates) {
    const content = tree.read(file, 'utf-8')!;

    tree.write(
      file,
      applyEdits(
        content,
        [...new Set(names.values())].map((statement) => removeStatement(statement, content)),
      ),
    );
  }
};

/** Points `export … from` of a deleted actions file at its queries file and drops those of other deleted files. */
const rewriteBarrels = (
  tree: Tree,
  graph: ModuleGraph,
  inScope: ReadonlySet<string>,
  deletedFiles: Set<string>,
  movedFiles: ReadonlyMap<string, string>,
  movedNames: ReadonlyMap<string, ReadonlySet<string>>,
) => {
  for (let changed = true; changed;) {
    changed = false;

    for (const file of inScope) {
      if (!file.endsWith('.ts') || deletedFiles.has(file) || !tree.exists(file)) continue;

      const content = tree.read(file, 'utf-8')!;

      if (!content.includes('export')) continue;

      const sourceFile = createSourceFile(content, file);
      const edits: TextEdit[] = [];

      for (const statement of sourceFile.statements) {
        if (
          !ts.isExportDeclaration(statement) ||
          !statement.moduleSpecifier ||
          !ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          continue;
        }

        const resolved = graph.resolveFile(file, statement.moduleSpecifier.text);

        if (!resolved || !deletedFiles.has(resolved)) continue;

        const movedTo = movedFiles.get(resolved);
        const clause = statement.exportClause;

        if (!movedTo) {
          edits.push(removeStatement(statement, content));
          continue;
        }

        if (clause && ts.isNamedExports(clause)) {
          const moved = clause.elements.filter((element) =>
            movedNames.get(resolved)?.has((element.propertyName ?? element.name).text),
          );

          edits.push(
            moved.length === 0
              ? removeStatement(statement, content)
              : {
                  start: statement.getStart(sourceFile),
                  end: statement.getEnd(),
                  text: `export { ${moved.map((element) => element.getText(sourceFile)).join(', ')} } from '${relativeSpecifier(file, movedTo)}';`,
                },
          );
          continue;
        }

        edits.push({
          start: statement.moduleSpecifier.getStart(sourceFile),
          end: statement.moduleSpecifier.getEnd(),
          text: `'${relativeSpecifier(file, movedTo)}'`,
        });
      }

      if (edits.length === 0) continue;

      const next = applyEdits(content, edits);

      tree.write(file, next);
      changed = true;

      if (createSourceFile(next).statements.length === 0) deletedFiles.add(file);
    }
  }
};
