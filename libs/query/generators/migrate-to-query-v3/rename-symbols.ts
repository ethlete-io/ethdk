import * as ts from 'typescript';
import { createSourceFile } from './shared.js';

export type SymbolRenameResult = {
  content: string;

  /** Names the rename deliberately left alone because the file also declares something by that name. */
  shadowed: string[];
};

/**
 * Whether an identifier is a *name* rather than a *reference* — a declaration, a property key, the
 * right-hand side of a member access. Renaming those is what turned `PeopleDetailDataSource.getPerson`
 * and the `postLogin` property of a config type into `legacy…` during the first migration run.
 */
const isNamePosition = (node: ts.Identifier) => {
  const parent = node.parent;

  if (!parent) return false;

  // `foo.bar` / `Foo.Bar` — the part after the dot is never the imported binding.
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;

  // Object literal / type member keys, enum members, JSX-ish attribute names.
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodSignature(parent) && parent.name === node) return true;
  if (ts.isEnumMember(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true;

  // Declarations of any kind.
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
  if (ts.isLabeledStatement(parent) && parent.label === node) return true;

  // Import / export clauses are rewritten by the caller, never by the reference pass.
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return true;
  if (ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return true;

  return false;
};

/** Every name the file declares itself — a local by the same name means the import is shadowed. */
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
    if (ts.isParameter(node)) add(node.name);
    if (ts.isBindingElement(node)) add(node.name);

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return declared;
};

/**
 * Renames references to imported bindings, and only those.
 *
 * `renames` maps a *local binding name* to its new name. The caller is responsible for having
 * verified that the binding really is the symbol being migrated (see `ModuleGraph`); this pass only
 * makes sure the rewrite lands on references rather than on same-named properties, declarations or
 * type members. A name the file also declares locally is skipped entirely and reported back, since
 * a rename there would silently change which value the code reads.
 */
export const renameImportedReferences = (content: string, renames: Map<string, string>): SymbolRenameResult => {
  if (renames.size === 0) return { content, shadowed: [] };

  const sourceFile = createSourceFile(content);
  const declaredLocally = collectLocalDeclarations(sourceFile);
  const shadowed = Array.from(renames.keys()).filter((name) => declaredLocally.has(name));
  const applicable = new Map(Array.from(renames.entries()).filter(([name]) => !declaredLocally.has(name)));

  if (applicable.size === 0) return { content, shadowed };

  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const nextName = applicable.get(node.text);

      if (nextName && !isNamePosition(node)) {
        replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: nextName });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return { content: result, shadowed };
};

/**
 * Drops named imports whose local name no longer appears anywhere else in the file.
 *
 * The migration rewrites away the constructs that needed `def`, `AnyLegacyQueryCreator` and friends;
 * leaving the imports behind turns every touched file into a lint error, and `formatFiles` runs in
 * the same generator invocation so they land that way. Identifiers inside template strings count as
 * usage too — a component referenced only from an inline template must not be pruned.
 */
export const pruneUnusedNamedImports = (content: string, moduleSpecifiers: readonly string[] | 'all') => {
  const sourceFile = createSourceFile(content);
  const used = new Set<string>();

  const addWordsFrom = (text: string) => {
    for (const word of text.match(/[A-Za-z_$][\w$]*/g) ?? []) {
      used.add(word);
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && !ts.isImportSpecifier(node.parent) && !ts.isImportClause(node.parent)) {
      used.add(node.text);
    }

    // A symbol referenced only from an inline template or a `styleUrl`-style string is still used.
    if (ts.isStringLiteralLike(node) && !ts.isImportDeclaration(node.parent)) {
      addWordsFrom(node.text);
    }

    if (ts.isTemplateLiteralToken(node)) {
      addWordsFrom(node.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  for (const node of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      (moduleSpecifiers !== 'all' && !moduleSpecifiers.includes(node.moduleSpecifier.text)) ||
      !node.importClause?.namedBindings ||
      !ts.isNamedImports(node.importClause.namedBindings)
    ) {
      continue;
    }

    const kept = node.importClause.namedBindings.elements.filter((element) => used.has(element.name.text));

    if (kept.length === node.importClause.namedBindings.elements.length) continue;

    const hasDefaultImport = !!node.importClause.name;

    if (kept.length === 0 && !hasDefaultImport) {
      const end = content[node.getEnd()] === '\n' ? node.getEnd() + 1 : node.getEnd();

      replacements.push({ start: node.getStart(sourceFile), end, replacement: '' });
      continue;
    }

    const defaultPart = hasDefaultImport ? `${node.importClause.name!.text}, ` : '';

    replacements.push({
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      replacement: `import ${defaultPart}{ ${kept.map((element) => element.getText(sourceFile)).join(', ')} } from '${node.moduleSpecifier.text}';`,
    });
  }

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return result;
};
