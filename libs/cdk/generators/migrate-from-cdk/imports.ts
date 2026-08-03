import * as ts from 'typescript';
import { CDK_PACKAGE } from './migration-map.js';

export type ImportRewrite = {
  to: string;
  package: string;
};

export type Replacement = {
  start: number;
  end: number;
  replacement: string;
};

export type CdkImportRewriteResult = {
  content: string;

  /** Local binding name → successor name, for the reference pass that follows. */
  renames: Map<string, string>;

  /** cdk symbols whose import was moved to a successor package. */
  moved: string[];
};

export const createSourceFile = (content: string, filePath = 'temp.ts') =>
  ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

export const applyReplacements = (content: string, replacements: readonly Replacement[]) => {
  let result = content;

  [...replacements]
    .sort((left, right) => right.start - left.start)
    .forEach(({ start, end, replacement }) => {
      result = result.slice(0, start) + replacement + result.slice(end);
    });

  return result;
};

const namedImportsOf = (declaration: ts.ImportDeclaration) => {
  const bindings = declaration.importClause?.namedBindings;

  return bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 ? bindings : null;
};

const importDeclarations = (sourceFile: ts.SourceFile) =>
  sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier),
  );

const moduleOf = (declaration: ts.ImportDeclaration) => (declaration.moduleSpecifier as ts.StringLiteral).text;

const renderImport = (specifiers: readonly string[], moduleSpecifier: string, typeOnly = false) =>
  `import ${typeOnly ? 'type ' : ''}{ ${specifiers.join(', ')} } from '${moduleSpecifier}';`;

/** The cdk symbols a file imports, in source order, keyed by the name the module exports. */
export const readCdkImportedSymbols = (content: string, filePath: string) => {
  const sourceFile = createSourceFile(content, filePath);
  const symbols: Array<{ name: string; line: number }> = [];

  for (const declaration of importDeclarations(sourceFile)) {
    if (moduleOf(declaration) !== CDK_PACKAGE) continue;

    const named = namedImportsOf(declaration);

    if (!named) continue;

    for (const element of named.elements) {
      symbols.push({
        name: (element.propertyName ?? element.name).text,
        line: sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile)).line + 1,
      });
    }
  }

  return symbols;
};

/**
 * Moves the given cdk specifiers to their successor packages, merging into an existing import from that
 * package when the file already has one. Returns the renames the reference pass still has to apply -
 * a moved specifier only carries its new name inside the import statement.
 */
export const rewriteCdkImports = (
  content: string,
  filePath: string,
  rewrites: Map<string, ImportRewrite>,
): CdkImportRewriteResult => {
  const sourceFile = createSourceFile(content, filePath);
  const declarations = importDeclarations(sourceFile);
  const cdkDeclarations = declarations.filter((declaration) => moduleOf(declaration) === CDK_PACKAGE);

  if (cdkDeclarations.length === 0) {
    return { content, renames: new Map(), moved: [] };
  }

  const mergeTargets = new Map<string, ts.NamedImports>();
  const importedNames = new Map<string, Set<string>>();

  for (const declaration of declarations) {
    const module = moduleOf(declaration);
    const named = namedImportsOf(declaration);

    if (!named) continue;

    const names = importedNames.get(module) ?? new Set<string>();

    named.elements.forEach((element) => names.add(element.name.text));
    importedNames.set(module, names);

    if (module !== CDK_PACKAGE && !declaration.importClause?.isTypeOnly && !mergeTargets.has(module)) {
      mergeTargets.set(module, named);
    }
  }

  const renames = new Map<string, string>();
  const moved: string[] = [];
  const additions = new Map<string, string[]>();
  const declarationEdits: Array<{ declaration: ts.ImportDeclaration; kept: string[] }> = [];

  for (const declaration of cdkDeclarations) {
    const named = namedImportsOf(declaration);

    if (!named) continue;

    const kept: string[] = [];
    let changed = false;

    for (const element of named.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      const localName = element.name.text;
      const rewrite = rewrites.get(importedName);

      if (!rewrite) {
        kept.push(element.getText(sourceFile));
        continue;
      }

      changed = true;
      moved.push(importedName);

      const typePrefix = declaration.importClause?.isTypeOnly || element.isTypeOnly ? 'type ' : '';
      const isAliased = !!element.propertyName;
      const specifier = isAliased ? `${typePrefix}${rewrite.to} as ${localName}` : `${typePrefix}${rewrite.to}`;
      const finalLocalName = isAliased ? localName : rewrite.to;

      if (!isAliased && rewrite.to !== localName) {
        renames.set(localName, rewrite.to);
      }

      const alreadyImported = importedNames.get(rewrite.package)?.has(finalLocalName);
      const pending = additions.get(rewrite.package) ?? [];

      if (!alreadyImported && !pending.includes(specifier)) {
        additions.set(rewrite.package, [...pending, specifier]);
      }
    }

    if (changed) {
      declarationEdits.push({ declaration, kept });
    }
  }

  if (declarationEdits.length === 0) {
    return { content, renames: new Map(), moved: [] };
  }

  const replacements: Replacement[] = [];
  const freshImports: string[] = [];

  for (const [module, specifiers] of additions) {
    const target = mergeTargets.get(module);

    if (target) {
      const lastElement = target.elements[target.elements.length - 1]!;

      replacements.push({
        start: lastElement.getEnd(),
        end: lastElement.getEnd(),
        replacement: `, ${specifiers.join(', ')}`,
      });

      continue;
    }

    freshImports.push(renderImport(specifiers, module));
  }

  declarationEdits.forEach(({ declaration, kept }, index) => {
    const isAnchor = index === 0;
    const anchoredImports = isAnchor ? freshImports : [];
    const start = declaration.getStart(sourceFile);
    const keptImport = kept.length > 0 ? [renderImport(kept, CDK_PACKAGE, declaration.importClause?.isTypeOnly)] : [];
    const lines = [...keptImport, ...anchoredImports];

    if (lines.length > 0) {
      replacements.push({ start, end: declaration.getEnd(), replacement: lines.join('\n') });

      return;
    }

    const end = content[declaration.getEnd()] === '\n' ? declaration.getEnd() + 1 : declaration.getEnd();

    replacements.push({ start, end, replacement: '' });
  });

  return { content: applyReplacements(content, replacements), renames, moved };
};

/**
 * Whether an identifier is a *name* rather than a *reference* - a declaration, a property key, the right
 * hand side of a member access. Renaming those would hit same-named properties and locals.
 */
const isNamePosition = (node: ts.Identifier) => {
  const parent = node.parent;

  if (!parent) return false;

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;

  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodSignature(parent) && parent.name === node) return true;
  if (ts.isEnumMember(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true;

  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isInterfaceDeclaration(parent) && parent.name === node) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumDeclaration(parent) && parent.name === node) return true;
  if (ts.isModuleDeclaration(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isGetAccessorDeclaration(parent) && parent.name === node) return true;
  if (ts.isSetAccessorDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isTypeParameterDeclaration(parent) && parent.name === node) return true;

  // Import and export clauses are rewritten by `rewriteCdkImports`, never by the reference pass.
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return true;
  if (ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return true;

  return false;
};

const collectLocalDeclarations = (sourceFile: ts.SourceFile) => {
  const declared = new Set<string>();

  const add = (name: ts.Node | undefined) => {
    if (name && ts.isIdentifier(name)) declared.add(name.text);
  };

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)) add(node.name);
    if (ts.isFunctionDeclaration(node)) add(node.name);
    if (ts.isClassDeclaration(node)) add(node.name);
    if (ts.isInterfaceDeclaration(node)) add(node.name);
    if (ts.isTypeAliasDeclaration(node)) add(node.name);
    if (ts.isEnumDeclaration(node)) add(node.name);

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return declared;
};

/** Renames references to the moved bindings. A name the file also declares itself is left alone. */
export const renameReferences = (content: string, filePath: string, renames: Map<string, string>) => {
  if (renames.size === 0) return content;

  const sourceFile = createSourceFile(content, filePath);
  const declaredLocally = collectLocalDeclarations(sourceFile);
  const replacements: Replacement[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const nextName = renames.get(node.text);

      if (nextName && !declaredLocally.has(node.text) && !isNamePosition(node)) {
        replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: nextName });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return applyReplacements(content, replacements);
};
