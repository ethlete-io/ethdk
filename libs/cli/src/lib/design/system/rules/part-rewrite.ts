import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { classifyImport, folderModulesOf } from '../imports';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { listSketches } from '../sketch/sketch';

export const PART_REWRITE = 'PART-REWRITE';

const REWRITE_METHODS = new Set(['replace', 'replaceAll']);

type Rewrite = { line: number; part: string; call: string };

const partImportsOf = (file: ts.SourceFile) => {
  const parts = new Map<string, string>();

  for (const declaration of file.statements.filter(ts.isImportDeclaration)) {
    const specifier = ts.isStringLiteral(declaration.moduleSpecifier) ? declaration.moduleSpecifier.text : '';
    const kind = classifyImport(specifier);
    const clause = declaration.importClause;
    const bindings = clause?.namedBindings;

    if (kind.kind !== 'part' || kind.stylesheet || clause?.isTypeOnly) continue;

    const key = `${kind.layer}/${kind.name}`;
    const names = [
      ...(clause?.name ? [clause.name.text] : []),
      ...(bindings && ts.isNamespaceImport(bindings) ? [bindings.name.text] : []),
      ...(bindings && ts.isNamedImports(bindings)
        ? bindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text)
        : []),
    ];

    for (const name of names) parts.set(name, key);
  }

  return parts;
};

const bindingNamesOf = (name: ts.BindingName): string[] =>
  ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : bindingNamesOf(element.name)));

const initializersOf = (file: ts.SourceFile) => {
  const initializers = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer)
      for (const name of bindingNamesOf(node.name)) initializers.set(name, node.initializer);
    ts.forEachChild(node, visit);
  };

  visit(file);

  return initializers;
};

const partBehind = (
  node: ts.Expression,
  context: { parts: Map<string, string>; initializers: Map<string, ts.Expression>; seen: Set<string> },
): string | null => {
  if (
    ts.isCallExpression(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  )
    return partBehind(node.expression, context);
  if (ts.isConditionalExpression(node))
    return partBehind(node.whenTrue, context) ?? partBehind(node.whenFalse, context);
  if (!ts.isIdentifier(node)) return null;

  const part = context.parts.get(node.text);

  if (part) return part;

  const initializer = context.initializers.get(node.text);

  if (!initializer || context.seen.has(node.text)) return null;

  return partBehind(initializer, { ...context, seen: new Set([...context.seen, node.text]) });
};

/** @internal Each `.replace`/`.replaceAll` in `source` on markup or a class string that an imported part produced. */
export const partRewritesIn = (source: string): Rewrite[] => {
  const file = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true);
  const context = { parts: partImportsOf(file), initializers: initializersOf(file), seen: new Set<string>() };
  const rewrites: Rewrite[] = [];

  if (context.parts.size === 0) return rewrites;

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      REWRITE_METHODS.has(node.expression.name.text)
    ) {
      const part = partBehind(node.expression.expression, context);

      if (part)
        rewrites.push({
          line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          part,
          call: `${node.expression.name.text}(${node.arguments[0]?.getText().slice(0, 60) ?? ''})`,
        });
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return rewrites;
};

const typeScriptFilesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return typeScriptFilesIn(path);

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });

const sketchModulesOf = (product: ResolvedProduct) =>
  listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
    typeof sketch === 'string' || sketch.decision?.kind === 'discard'
      ? []
      : typeScriptFilesIn(sketch.dir).map((file) => ({ file, source: readFileSync(file, 'utf8') })),
  );

/** A part, page or sketch module that rewrites an imported part's markup or class string instead of passing it an option. */
export const partRewritesOf = (product: ResolvedProduct): Problem[] => {
  const modules = new Map<string, string>();

  for (const part of product.parts)
    for (const module of [{ file: part.file, source: part.source }, ...folderModulesOf(part)])
      modules.set(module.file, module.source);
  for (const module of sketchModulesOf(product)) modules.set(module.file, module.source);

  return [...modules].flatMap(([file, source]) =>
    partRewritesIn(source).map(({ line, part, call }) => ({
      rule: PART_REWRITE,
      file,
      message: `line ${line}: ${call} rewrites the markup of ${part} - give ${part} an option for this look and pass it`,
    })),
  );
};
