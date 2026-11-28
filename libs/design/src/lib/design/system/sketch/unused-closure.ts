import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve, sep } from 'path';
import ts from 'typescript';
import { ASSETS_FOLDER } from '../assets';
import { classesOf, cssBlocksOf } from '../css-source';
import { classifyImport, SHARED_PREFIX, sharedFileOf } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { importsOf } from '../ts-source';
import { sharedDirOf, Sketch, variantDirOf, variantSharedDirOf } from './sketch';

const RULE = 'UNUSED';
const SDK_CLASS_PREFIX = 'et-';
const CODE = /\.(?:ts|css)$/u;

const variantFilesOf = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => CODE.test(path) && !path.endsWith('.spec.ts') && path.split(sep)[0] !== ASSETS_FOLDER)
        .map((path) => resolve(dir, path))
    : [];

const relativeFileOf = (path: string) =>
  [path, `${path}.ts`, resolve(path, 'index.ts')].find((candidate) => CODE.test(candidate) && existsSync(candidate)) ??
  null;

const closureOf = (options: { sketch: Sketch; variant: string }) => {
  const { sketch, variant } = options;
  const sharedDirs = [variantSharedDirOf(sketch, variant), sharedDirOf(sketch)];
  const files = new Set(variantFilesOf(variantDirOf(sketch, variant)));
  const queue = [...files];

  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (!file.endsWith('.ts')) continue;

    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      const kind = classifyImport(specifier).kind;
      const path = specifier.split('?')[0] ?? specifier;
      const found =
        kind === 'shared'
          ? sharedFileOf({ dirs: sharedDirs, path: path.slice(SHARED_PREFIX.length) })
          : kind === 'relative'
            ? relativeFileOf(resolve(dirname(file), path))
            : null;

      if (found && !files.has(found)) {
        files.add(found);
        queue.push(found);
      }
    }
  }

  return [...files];
};

const nodesOf = (root: ts.Node) => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };

  visit(root);

  return nodes;
};

const isReference = (node: ts.Node): node is ts.Identifier =>
  ts.isIdentifier(node) &&
  !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
  !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
  !(ts.isPropertySignature(node.parent) && node.parent.name === node);

const unusedImportsOf = (file: string, source: ts.SourceFile): Problem[] => {
  const declarations = source.statements.filter(ts.isImportDeclaration);
  const used = new Set(
    source.statements
      .filter((statement) => !ts.isImportDeclaration(statement))
      .flatMap((statement) => nodesOf(statement))
      .filter(isReference)
      .map((node) => node.text),
  );

  return declarations.flatMap((declaration) => {
    const clause = declaration.importClause;
    const bindings = clause?.namedBindings;
    const names = [
      ...(clause?.name ? [clause.name.text] : []),
      ...(bindings && ts.isNamespaceImport(bindings) ? [bindings.name.text] : []),
      ...(bindings && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : []),
    ];

    return names
      .filter((name) => !used.has(name))
      .map((name) => ({ rule: RULE, file, message: `imports ${name} but never uses it - remove the import` }));
  });
};

type FunctionLike = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration;

const isFunctionLike = (node: ts.Node): node is FunctionLike =>
  ts.isFunctionDeclaration(node) ||
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) ||
  ts.isMethodDeclaration(node);

const nameOfFunction = (node: FunctionLike) => {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name && ts.isIdentifier(node.name))
    return node.name.text;
  if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;

  return null;
};

const unreferencedParamsOf = (file: string, source: ts.SourceFile): Problem[] =>
  nodesOf(source)
    .filter(isFunctionLike)
    .flatMap((fn) => {
      if (!fn.body || ts.isMethodDeclaration(fn) || nameOfFunction(fn) === null) return [];

      const used = new Set(
        nodesOf(fn.body)
          .filter(isReference)
          .map((node) => node.text),
      );
      const params = fn.parameters.map((param) => (ts.isIdentifier(param.name) ? param.name.text : null));
      const lastUsed = Math.max(...params.map((name, index) => (name === null || used.has(name) ? index : -1)), -1);

      return params
        .slice(lastUsed + 1)
        .filter((name): name is string => name !== null && !name.startsWith('_'))
        .map((name) => ({
          rule: RULE,
          file,
          message: `${nameOfFunction(fn)} takes ${name} but never uses it - remove the parameter`,
        }));
    });

const isDeclaredName = (node: ts.Identifier) =>
  (ts.isVariableDeclaration(node.parent) ||
    ts.isFunctionDeclaration(node.parent) ||
    ts.isImportSpecifier(node.parent) ||
    ts.isExportSpecifier(node.parent)) &&
  node.parent.name === node;

const argumentCountsOf = (nodes: ts.Node[], name: string) => {
  const references = nodes.filter(
    (node): node is ts.Identifier => isReference(node) && node.text === name && !isDeclaredName(node),
  );

  if (references.length === 0) return null;

  const counts = references.map((node) =>
    ts.isCallExpression(node.parent) && node.parent.expression === node ? node.parent.arguments.length : null,
  );

  return counts.every((count) => count !== null) ? (counts as number[]) : null;
};

const unpassedParamsOf = (options: {
  scripts: { file: string; source: ts.SourceFile }[];
  callers: { file: string; source: ts.SourceFile }[];
  shared: string[];
}) => {
  const nodes = options.callers.flatMap(({ source }) => nodesOf(source));

  return options.scripts
    .filter(({ file }) => options.shared.some((dir) => file.startsWith(`${dir}${sep}`)))
    .flatMap(({ file, source }) =>
      nodesOf(source)
        .filter(isFunctionLike)
        .flatMap((fn) => {
          const name = nameOfFunction(fn);
          const counts = name ? argumentCountsOf(nodes, name) : null;

          if (!name || !counts || fn.parameters.some((param) => param.dotDotDotToken)) return [];

          return fn.parameters
            .slice(Math.max(...counts))
            .flatMap((param) =>
              ts.isIdentifier(param.name) && !param.name.text.startsWith('_')
                ? [{ rule: RULE, file, message: `no call of ${name} passes ${param.name.text} - remove the parameter` }]
                : [],
            );
        }),
    );
};

const mentions = (source: string, name: string) => {
  const parts = name.split('-');

  return (
    new RegExp(`(?<![\\w-])${name}(?![\\w-])`, 'u').test(source) ||
    parts.slice(1).some((_, index) => source.includes(`${parts.slice(0, index + 1).join('-')}-\${`))
  );
};

const unusedClassesOf = (options: { css: string[]; sources: string[] }): Problem[] =>
  options.css.flatMap((file) => {
    const classes = new Set(cssBlocksOf(readFileSync(file, 'utf8')).selectors.flatMap(classesOf));

    return [...classes]
      .filter((name) => !name.startsWith(SDK_CLASS_PREFIX) && !options.sources.some((source) => mentions(source, name)))
      .map((name) => ({
        rule: RULE,
        file,
        message: `styles .${name}, which nothing the variant draws uses - remove the rule`,
      }));
  });

/**
 * The unused imports, parameters and CSS classes in the files a variant holds and the `shared/` files they import:
 * leftovers of other candidates that a merge would carry into the product.
 */
export const unusedInVariantOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): Problem[] => {
  const { product, sketch } = options;
  const files = closureOf(options);
  const scripts = files
    .filter((file) => file.endsWith('.ts'))
    .map((file) => {
      const text = readFileSync(file, 'utf8');

      return { file, text, source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true) };
    });
  const otherParts = product.parts.filter((part) => !sketch.targets.includes(partKeyOf(part)));
  const otherSources = otherParts.map((part) => part.source);
  const sharedDir = `${sharedDirOf(sketch)}${sep}`;
  const css = files.filter((file) => file.endsWith('.css'));
  const sketchFiles = [
    ...new Set(
      sketch.variants.flatMap((variant) => closureOf({ sketch, variant }).filter((file) => file.endsWith('.ts'))),
    ),
  ];
  const sketchScripts = sketchFiles.map((file) => readFileSync(file, 'utf8'));
  const callers = sketchFiles.map((file, index) => ({
    file,
    source: ts.createSourceFile(file, sketchScripts[index] ?? '', ts.ScriptTarget.Latest, true),
  }));

  return [
    ...scripts.flatMap(({ file, source }) => [...unusedImportsOf(file, source), ...unreferencedParamsOf(file, source)]),
    ...unpassedParamsOf({
      scripts,
      callers,
      shared: [variantSharedDirOf(sketch, options.variant), sharedDirOf(sketch)],
    }),
    ...unusedClassesOf({
      css: css.filter((file) => !file.startsWith(sharedDir)),
      sources: [...scripts.map((script) => script.text), ...otherSources],
    }),
    ...unusedClassesOf({
      css: css.filter((file) => file.startsWith(sharedDir)),
      sources: [...sketchScripts, ...otherSources],
    }),
  ];
};
