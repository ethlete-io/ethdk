import * as ts from 'typescript';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';
import { createSourceFile, ensureNamedImports } from '../migrate-to-query-v3/shared.js';
import { TOOLKIT_MODULE, ToolkitCall, ToolkitFeature } from './feature.js';
import { TOOLKIT_TASK, ToolkitTaskInput } from './report.js';
import {
  TextEdit,
  applyEdits,
  collapseBlankLines,
  lineOf,
  pruneUnusedImports,
  relativeSpecifier,
  removeStatement,
} from './ts-edits.js';

export const INTEROP_MODULE = '@ethlete/query/ngrx-toolkit';

const STORE_TYPES = new Set(['Store', 'Actions']);

const FACADE_BASE_MEMBERS = new Set([
  'call',
  'select',
  'selectIsInit',
  'selectIsLoading',
  'selectIsSuccess',
  'selectIsError',
  'selectResponse',
  'selectCachedResponse',
  'selectError',
  'selectArgs',
  'selectEntityId',
  'selectTimestamp',
  'selectType',
  'selectCallState',
  'remove',
  'on',
  'once',
]);

export type FacadeRewrite = { content: string } | { blockers: ToolkitTaskInput[] };

type ImportedName = { specifier: string; imported: string | null };

const importTable = (sourceFile: ts.SourceFile) => {
  const table = new Map<string, ImportedName>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const specifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;

    if (clause?.name) table.set(clause.name.text, { specifier, imported: 'default' });

    const bindings = clause?.namedBindings;

    if (bindings && ts.isNamespaceImport(bindings)) table.set(bindings.name.text, { specifier, imported: null });

    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        table.set(element.name.text, { specifier, imported: element.propertyName?.text ?? element.name.text });
      }
    }
  }

  return table;
};

const typeNameOf = (type: ts.TypeNode | undefined) =>
  type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) ? type.typeName.text : null;

const isInjectOfStore = (expression: ts.Expression | undefined, storeTypeNames: Set<string>) =>
  !!expression &&
  ts.isCallExpression(expression) &&
  ts.isIdentifier(expression.expression) &&
  expression.expression.text === 'inject' &&
  !!expression.arguments[0] &&
  ts.isIdentifier(expression.arguments[0]) &&
  storeTypeNames.has(expression.arguments[0].text);

/**
 * Rewrites a `FacadeBase` facade to call the v3 creators through `toolkitCall`. Returns blockers instead of content
 * when a member still needs the NgRx store.
 */
export const rewriteFacade = (
  content: string,
  feature: ToolkitFeature,
  graph: ModuleGraph,
  storeFiles: ReadonlySet<string>,
): FacadeRewrite => {
  const facadeFile = feature.files.facade!;
  const sourceFile = createSourceFile(content, facadeFile);
  const imports = importTable(sourceFile);
  const callsByName = new Map(feature.calls.map((call) => [call.name, call]));

  const storeTypeNames = new Set<string>();
  const storeImportNames = new Set<string>();

  for (const [local, { specifier, imported }] of imports) {
    if ((specifier === '@ngrx/store' || specifier === '@ngrx/effects') && imported && STORE_TYPES.has(imported)) {
      storeTypeNames.add(local);
    }

    if (specifier === TOOLKIT_MODULE || specifier.startsWith('@ngrx/')) storeImportNames.add(local);

    const resolved = graph.resolveFile(facadeFile, specifier);

    if (resolved && storeFiles.has(resolved)) storeImportNames.add(local);
  }

  const facadeClass = sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) &&
      !!statement.heritageClauses?.some((clause) =>
        clause.types.some((type) => type.expression.getText() === 'FacadeBase'),
      ),
  );

  if (!facadeClass) {
    return {
      blockers: [
        {
          id: TOOLKIT_TASK.FACADE_STORE_MEMBER,
          summary: `${facadeFile} has no class that extends \`FacadeBase\`.`,
          locations: [{ filePath: facadeFile }],
        },
      ],
    };
  }

  const storeMembers = new Set<string>();

  for (const member of facadeClass.members) {
    if (ts.isConstructorDeclaration(member)) {
      for (const parameter of member.parameters) {
        if (ts.isIdentifier(parameter.name) && storeTypeNames.has(typeNameOf(parameter.type) ?? '')) {
          storeMembers.add(parameter.name.text);
        }
      }
    }

    if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      (storeTypeNames.has(typeNameOf(member.type) ?? '') || isInjectOfStore(member.initializer, storeTypeNames))
    ) {
      storeMembers.add(member.name.text);
    }
  }

  const blockers: ToolkitTaskInput[] = [];
  const edits: TextEdit[] = [];
  const usedCreators = new Set<string>();
  let usesActionCallArgs = false;

  const actionNameOf = (expression: ts.Expression) => {
    if (ts.isIdentifier(expression)) {
      const imported = imports.get(expression.text);
      const resolved = imported ? graph.resolveFile(facadeFile, imported.specifier) : null;

      return resolved === feature.files.actions ? (imported?.imported ?? null) : null;
    }

    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      const imported = imports.get(expression.expression.text);
      const resolved =
        imported && imported.imported === null ? graph.resolveFile(facadeFile, imported.specifier) : null;

      return resolved === feature.files.actions ? expression.name.text : null;
    }

    return null;
  };

  const simpleCall = (member: ts.ClassElement): { call: ToolkitCall; argument: ts.Expression } | null => {
    if (!ts.isMethodDeclaration(member) || member.body?.statements.length !== 1) return null;

    const statement = member.body.statements[0]!;
    const expression = ts.isReturnStatement(statement) ? statement.expression : undefined;

    if (
      !expression ||
      !ts.isCallExpression(expression) ||
      !ts.isPropertyAccessExpression(expression.expression) ||
      expression.expression.expression.kind !== ts.SyntaxKind.ThisKeyword ||
      expression.expression.name.text !== 'call' ||
      expression.arguments.length !== 2
    ) {
      return null;
    }

    const name = actionNameOf(expression.arguments[0]!);
    const call = name ? callsByName.get(name) : undefined;

    return call ? { call, argument: expression.arguments[1]! } : null;
  };

  const storeDependency = (member: ts.Node): string | null => {
    let found: string | null = null;

    const visit = (node: ts.Node) => {
      if (found) return;

      if (
        ts.isPropertyAccessExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ThisKeyword || node.expression.kind === ts.SyntaxKind.SuperKeyword) &&
        (storeMembers.has(node.name.text) || FACADE_BASE_MEMBERS.has(node.name.text))
      ) {
        found = node.getText(sourceFile);
        return;
      }

      if (ts.isIdentifier(node) && storeImportNames.has(node.text) && !ts.isPropertyAccessExpression(node.parent)) {
        found = node.text;
        return;
      }

      if (
        ts.isIdentifier(node) &&
        storeImportNames.has(node.text) &&
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node
      ) {
        found = node.text;
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(member);

    return found;
  };

  const injectorName = facadeClass.members.some((member) => member.name?.getText(sourceFile) === 'injector')
    ? 'toolkitInjector'
    : 'injector';

  for (const member of facadeClass.members) {
    const call = simpleCall(member);

    if (call && ts.isMethodDeclaration(member)) {
      usedCreators.add(call.call.name);

      const parameter = member.parameters[0];
      const parameterType = parameter?.type?.getText(sourceFile).replace(/\s+/g, ' ');
      const args = call.call.args;
      const toolkitArgsType = /^ActionCallArgs<typeof ([\w.]+)>$/.exec(parameterType ?? '');
      const replaceType =
        !!parameter?.type &&
        ((args && parameterType === args.typeText && args.extraKeys.length === 0) ||
          (!!toolkitArgsType && toolkitArgsType[1]!.split('.').pop() === call.call.name));

      if (replaceType) {
        usesActionCallArgs = true;
        edits.push({
          start: parameter.type.getStart(sourceFile),
          end: parameter.type.getEnd(),
          text: `ActionCallArgs<typeof ${call.call.name}>`,
        });
      }

      edits.push({
        start: member.body!.getStart(sourceFile),
        end: member.body!.getEnd(),
        text: `{\n    return toolkitCall(${call.call.name}, ${call.argument.getText(sourceFile)}, { injector: this.${injectorName} });\n  }`,
      });
      continue;
    }

    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && storeMembers.has(member.name.text)) {
      edits.push(removeStatement(member, content));
      continue;
    }

    if (ts.isConstructorDeclaration(member)) {
      const body = member.body?.statements ?? ts.factory.createNodeArray<ts.Statement>();
      const storeLocals = new Set<string>();

      const keptStatements = body.filter((statement) => {
        if (
          ts.isExpressionStatement(statement) &&
          ts.isCallExpression(statement.expression) &&
          statement.expression.expression.kind === ts.SyntaxKind.SuperKeyword
        ) {
          return false;
        }

        if (ts.isVariableStatement(statement)) {
          const declarations = statement.declarationList.declarations;

          if (declarations.every((declaration) => isInjectOfStore(declaration.initializer, storeTypeNames))) {
            declarations.forEach((declaration) => storeLocals.add(declaration.name.getText(sourceFile)));
            return false;
          }
        }

        if (
          ts.isExpressionStatement(statement) &&
          ts.isBinaryExpression(statement.expression) &&
          ts.isPropertyAccessExpression(statement.expression.left) &&
          storeMembers.has(statement.expression.left.name.text)
        ) {
          return false;
        }

        return true;
      });

      const keptParameters = member.parameters.filter(
        (parameter) => !(ts.isIdentifier(parameter.name) && storeMembers.has(parameter.name.text)),
      );

      for (const statement of keptStatements) {
        const dependency = storeDependency(statement);

        if (
          dependency ||
          [...storeLocals].some((local) => new RegExp(`\\b${local}\\b`).test(statement.getText(sourceFile)))
        ) {
          blockers.push({
            id: TOOLKIT_TASK.FACADE_STORE_MEMBER,
            summary: `The constructor of the facade uses the store (\`${dependency ?? statement.getText(sourceFile)}\`).`,
            locations: [{ filePath: facadeFile, line: lineOf(sourceFile, statement.getStart(sourceFile)) }],
          });
        }
      }

      if (keptStatements.length === 0 && keptParameters.length === 0) {
        edits.push(removeStatement(member, content));
        continue;
      }

      edits.push({
        start: member.getStart(sourceFile),
        end: member.getEnd(),
        text: `constructor(${keptParameters.map((parameter) => parameter.getText(sourceFile)).join(', ')}) {\n${keptStatements
          .map((statement) => `    ${statement.getText(sourceFile)}`)
          .join('\n')}\n  }`,
      });
      continue;
    }

    const dependency = storeDependency(member);

    if (dependency) {
      blockers.push({
        id: TOOLKIT_TASK.FACADE_STORE_MEMBER,
        summary: `\`${member.name?.getText(sourceFile) ?? 'A member'}\` uses \`${dependency}\`.`,
        locations: [{ filePath: facadeFile, line: lineOf(sourceFile, member.getStart(sourceFile)) }],
      });
    }
  }

  if (blockers.length > 0) return { blockers };

  const heritage = facadeClass.heritageClauses!.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)!;

  edits.push({ start: heritage.getFullStart(), end: heritage.getEnd(), text: '' });

  const bodyStart = facadeClass.members.pos;

  edits.push({
    start: bodyStart,
    end: bodyStart,
    text: `\n  private ${injectorName} = inject(Injector);\n`,
  });

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const specifier = statement.moduleSpecifier.text;
    const resolved = graph.resolveFile(facadeFile, specifier);

    if (specifier === TOOLKIT_MODULE || (resolved && storeFiles.has(resolved))) {
      edits.push(removeStatement(statement, content));
    }
  }

  let result = applyEdits(content, edits);

  result = ensureNamedImports({
    content: result,
    importsNeeded: ['inject', 'Injector'],
    moduleSpecifier: '@angular/core',
  });
  result = ensureNamedImports({
    content: result,
    importsNeeded: usesActionCallArgs ? ['ActionCallArgs', 'toolkitCall'] : ['toolkitCall'],
    moduleSpecifier: INTEROP_MODULE,
  });

  if (usedCreators.size > 0) {
    result = ensureNamedImports({
      content: result,
      importsNeeded: [...usedCreators],
      moduleSpecifier: relativeSpecifier(facadeFile, feature.queriesFile),
    });
  }

  return { content: collapseBlankLines(pruneUnusedImports(result)) };
};
