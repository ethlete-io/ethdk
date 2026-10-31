import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import postcss from 'postcss';
import ts from 'typescript';
import { ProductSource } from '../base';
import { ownSharedFilesOf, SharedDirs } from '../imports';
import { productStylesheetFilesOf } from '../product-stylesheets';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { sourceFileOf, textsOf } from '../ts-source';

const CLASS_FACTS = `
const { __unstable__loadDesignSystem } = require(process.argv[1]);
const { css, base, rem, candidates } = JSON.parse(require('fs').readFileSync(0, 'utf8'));
__unstable__loadDesignSystem(css, { base })
  .then((system) => process.stdout.write(JSON.stringify(candidates.map((c) => ({
    canonical: system.canonicalizeCandidates([c], { rem }).join(' '),
    emitsNothing: system.parseCandidate(c).some((p) => p.kind !== 'functional' || p.value !== null) && system.candidatesToCss([c])[0] === null,
  })))))
  .catch((error) => { process.stderr.write(String(error && error.message || error)); process.exit(1); });
`;

const DEFAULT_REM = 16;

/** What Tailwind makes of a class under a product's stylesheets: its canonical form, and whether it parses as a utility with a value that emits no CSS. */
export type ClassFacts = { canonical: string; emitsNothing: boolean };

export type PartClasses = {
  target: string;
  stylesheets: string[];
  files: { file: string; source: string; candidates: string[]; classes: string[] }[];
};

const styleSourceOf = (product: ResolvedProduct) =>
  [product, product.base].find((each): each is ProductSource => !!each?.config.styles?.length);

const remOf = (files: Set<string>) => {
  let rem = DEFAULT_REM;

  for (const file of files) {
    try {
      postcss.parse(readFileSync(file, 'utf8')).walkRules(/^(?:html|:root)$/u, (rule) =>
        rule.walkDecls('font-size', (declaration) => {
          const [, amount, unit] = /^(\d*\.?\d+)(%|px)$/u.exec(declaration.value.trim()) ?? [];

          if (amount) rem = unit === '%' ? (DEFAULT_REM * Number(amount)) / 100 : Number(amount);
        }),
      );
    } catch {
      continue;
    }
  }

  return rem;
};

const candidatesIn = (texts: string[]) => texts.flatMap((text) => text.split(/[\s"'`<>]+/u).filter(Boolean));

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const isCompared = (node: ts.Node) =>
  (ts.isBinaryExpression(node.parent) && COMPARISONS.has(node.parent.operatorToken.kind)) ||
  ts.isCaseClause(node.parent) ||
  ts.isImportDeclaration(node.parent) ||
  ts.isExportDeclaration(node.parent) ||
  (ts.isPropertyAssignment(node.parent) && node.parent.name === node);

const isProse = (text: string) => /[.!?;](?:\s|$)|,\s|(?:^|\s)[A-Z][a-z]/u.test(text);

const literalOf = (node: ts.Node) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return { text: node.text, expression: node };
  if (ts.isTemplateHead(node)) return { text: node.text, expression: node.parent };
  if (ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return { text: node.text, expression: node.parent.parent };

  return null;
};

const RENDERER_MODULES = '@ethlete/components/design/';

const rendererNamesOf = (file: ts.SourceFile) =>
  new Set(
    file.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith(RENDERER_MODULES) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements.map((element) => element.name.text)
        : [],
    ),
  );

const isRendererOption = (node: ts.Node, renderers: Set<string>) => {
  const property = node.parent;
  const options = property?.parent;
  const call = options?.parent;

  return (
    ts.isPropertyAssignment(property) &&
    property.initializer === node &&
    !(ts.isIdentifier(property.name) && property.name.text === 'class') &&
    ts.isObjectLiteralExpression(options) &&
    ts.isCallExpression(call) &&
    call.arguments.includes(options) &&
    ts.isIdentifier(call.expression) &&
    renderers.has(call.expression.text)
  );
};

const classTextsOf = (node: ts.Node, renderers: Set<string>): string[] => {
  const literal = literalOf(node);

  if (!literal || isCompared(literal.expression)) return [];
  if (!literal.text.includes('<') && isRendererOption(literal.expression, renderers)) return [];
  if (literal.text.includes('<'))
    return [...literal.text.matchAll(/\bclass=["']([^"']*)/gu)].map(([, value]) => value ?? '');

  return isProse(literal.text) ? [] : [literal.text];
};

const classesIn = (source: string) => {
  const texts: string[] = [];
  const file = sourceFileOf(source);
  const renderers = rendererNamesOf(file);
  const visit = (node: ts.Node) => {
    texts.push(...classTextsOf(node, renderers));
    ts.forEachChild(node, visit);
  };

  visit(file);

  return [...new Set(texts.flatMap((text) => text.split(/\s+/u).filter(Boolean)))];
};

const tsSourcesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts'))
        .map((path) => resolve(dir, path))
        .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    : [];

const sourcesOf = (part: ResolvedPart) => [
  { file: part.file, source: part.source },
  ...tsSourcesIn(dirname(part.file)).filter(({ file }) => file !== part.file),
];

/** The candidate classes in the markup of the product's own parts, the files below them and the shared files they import, with the product's stylesheets. */
export const partClassesOf = (product: ResolvedProduct & SharedDirs): PartClasses | null => {
  const source = styleSourceOf(product);

  if (!source) return null;

  const target = resolve(dirname(source.configFile), '../..');
  const stylesheets = (source.config.styles ?? []).map((style) => resolve(target, style));
  const below = product.parts.filter((part) => part.origin !== 'base').flatMap(sourcesOf);
  const shared = ownSharedFilesOf(
    product,
    below.map(({ file }) => file),
  )
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
  const files = [...new Map([...below, ...shared].map((entry) => [entry.file, entry])).values()]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((entry) => ({
      ...entry,
      candidates: [...new Set(candidatesIn(textsOf(entry.source)))],
      classes: classesIn(entry.source),
    }));

  return { target: resolve(dirname(product.configFile), '../..'), stylesheets, files };
};

/** The class names the product's own stylesheets, and every file they import, give a rule. */
export const stylesheetClassesOf = (product: ResolvedProduct) => {
  const source = styleSourceOf(product);
  const names = new Set<string>();

  for (const file of source ? productStylesheetFilesOf(source) : []) {
    try {
      postcss.parse(readFileSync(file, 'utf8')).walkRules((rule) => {
        for (const [, name] of rule.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/gu)) if (name) names.add(name);
      });
    } catch {
      continue;
    }
  }

  return names;
};

const factsCache = new Map<string, Map<string, ClassFacts>>();

/** Tailwind's facts on each candidate under the product's stylesheets; the root font size they set on `html` is the rem base. */
export const classFactsOf = (options: { product: ResolvedProduct; classes: PartClasses }) => {
  const { target, stylesheets, files } = options.classes;
  const source = styleSourceOf(options.product);
  const rem = remOf(source ? productStylesheetFilesOf(source) : new Set());
  const css = stylesheets.map((file) => `@import ${JSON.stringify(file)};`).join('\n');
  const key = `${rem}\n${css}`;
  const known = factsCache.get(key) ?? new Map<string, ClassFacts>();
  const missing = [...new Set(files.flatMap((file) => [...file.candidates, ...file.classes]))].filter(
    (candidate) => !known.has(candidate),
  );

  factsCache.set(key, known);

  if (missing.length > 0) {
    const tailwind = require.resolve('@tailwindcss/node', { paths: [target, __dirname] });
    const output = execFileSync(process.execPath, ['-e', CLASS_FACTS, tailwind], {
      input: JSON.stringify({ css, base: target, rem, candidates: missing }),
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const facts = JSON.parse(output) as ClassFacts[];

    missing.forEach((candidate, index) =>
      known.set(candidate, facts[index] ?? { canonical: candidate, emitsNothing: false }),
    );
  }

  return known;
};

/** Why Tailwind could not load the product's design system. */
export const tailwindFailureOf = (error: unknown) =>
  (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
