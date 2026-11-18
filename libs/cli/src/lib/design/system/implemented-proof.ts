import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, posix, relative, resolve } from 'path';
import ts from 'typescript';
import { appFilesOf } from './app-files';
import { exportedComponentClassesOf, sourceFileOf } from './ts-source';
import { angularCompilerOf, componentTemplateOf } from './undesigned-branches';

/** The reasons a part's app component may not be recorded as implemented yet, `[]` when it may. */
export type ImplementedRefusals = (options: { root: string; component: string }) => Promise<string[]>;

type Compiler = NonNullable<Awaited<ReturnType<typeof angularCompilerOf>>>;

const FIXTURE_MODULE = /(?:^|[/._-])(?:sample|samples|fixture|fixtures)(?:$|[/._-])/iu;

const FIXTURE_NAME = /_(?:SAMPLE|FIXTURE)S?$/u;

const VISIBLE_ATTRIBUTES = new Set([
  'title',
  'alt',
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'ariaLabel',
  'ariaDescription',
  'ariaPlaceholder',
  'ariaRoleDescription',
  'ariaValueText',
]);

const hasLetter = (text: string) => /\p{L}/u.test(text);

const readOrNull = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

const toPosix = (path: string) => path.split('\\').join(posix.sep);

const fixtureValuesOf = (options: { spec: ts.SourceFile; specFile: string; root: string }) => {
  const { spec, specFile, root } = options;
  const names = new Set<string>();

  for (const statement of spec.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;

    const clause = statement.importClause;

    if (!clause || clause.isTypeOnly) continue;

    const specifier = statement.moduleSpecifier.text;
    const fromFixture =
      FIXTURE_MODULE.test(specifier) ||
      (specifier.startsWith('.') &&
        toPosix(relative(root, resolve(dirname(specFile), specifier))).startsWith('.ethlete/'));
    const bindings = clause.namedBindings;
    const named =
      bindings && ts.isNamedImports(bindings)
        ? bindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text)
        : [];
    const whole = [
      ...(clause.name ? [clause.name.text] : []),
      ...(bindings && ts.isNamespaceImport(bindings) ? [bindings.name.text] : []),
    ];

    [...named, ...whole].filter((name) => fromFixture || FIXTURE_NAME.test(name)).forEach((name) => names.add(name));
  }

  return names;
};

const valueNamesOf = (node: ts.Node) => {
  const names = new Set<string>();
  const visit = (child: ts.Node) => {
    if (ts.isTypeNode(child)) return;
    if (ts.isIdentifier(child)) names.add(child.text);

    ts.forEachChild(child, visit);
  };

  visit(node);

  return names;
};

const testCallbacksOf = (spec: ts.SourceFile) => {
  const tests: ts.Node[] = [];
  const setups: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callback = node.arguments.find(
        (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
      );
      const name = node.expression.text;

      if (callback && (name === 'it' || name === 'test')) tests.push(callback);
      if (callback && name === 'beforeEach') setups.push(callback);
    }

    ts.forEachChild(node, visit);
  };

  visit(spec);

  return { tests, setups };
};

const rendersOf = (options: { spec: ts.SourceFile; specFile: string; componentFile: string; classes: string[] }) => {
  const { spec, specFile, componentFile, classes } = options;
  const imported = spec.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('.') &&
      resolve(dirname(specFile), `${statement.moduleSpecifier.text}.ts`) === componentFile &&
      !statement.importClause?.isTypeOnly &&
      [...valueNamesOf(statement)].some((name) => classes.includes(name)),
  );

  return imported && spec.text.includes('createComponent(');
};

const specRefusalsOf = (options: { root: string; component: string }) => {
  const { root, component } = options;
  const componentFile = resolve(root, component);
  const source = readOrNull(componentFile);
  const classes = source === null ? [] : exportedComponentClassesOf(source);

  if (classes.length === 0) return [`NO-COMPONENT ${component}: no exported component class to record`];

  const dir = dirname(componentFile);
  const specs = readdirSync(dir)
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => resolve(dir, name))
    .map((specFile) => ({ specFile, spec: sourceFileOf(readFileSync(specFile, 'utf8')) }))
    .filter(({ spec, specFile }) => rendersOf({ spec, specFile, componentFile, classes }));

  if (specs.length === 0)
    return [
      `NO-SPEC ${component}: no spec in its folder renders ${classes.join(', ')} - add one that renders it with data other than the design's fixture`,
    ];

  const fixtureOnly = specs.map(({ spec, specFile }) => {
    const fixture = fixtureValuesOf({ spec, specFile, root });
    const { tests, setups } = testCallbacksOf(spec);
    const used = (node: ts.Node) => [...valueNamesOf(node)].filter((name) => fixture.has(name));
    const setupUses = setups.flatMap(used);
    const ownData = setupUses.length === 0 && tests.some((test) => used(test).length === 0);

    return ownData ? null : { specFile, names: [...new Set([...setupUses, ...tests.flatMap(used)])] };
  });

  if (fixtureOnly.some((entry) => entry === null)) return [];

  return fixtureOnly.flatMap((entry) =>
    entry
      ? [
          `FIXTURE-SPEC ${component}: every test of ${toPosix(relative(root, entry.specFile))} renders fixture data (${entry.names.join(', ')}) - add one with other data`,
        ]
      : [],
  );
};

const shownLiteralsOf = (compiler: Compiler, node: unknown): string[] => {
  if (node instanceof compiler.ASTWithSource) return shownLiteralsOf(compiler, node.ast);
  if (node instanceof compiler.ParenthesizedExpression) return shownLiteralsOf(compiler, node.expression);
  if (node instanceof compiler.LiteralPrimitive) return typeof node.value === 'string' ? [node.value] : [];
  if (node instanceof compiler.Conditional)
    return [...shownLiteralsOf(compiler, node.trueExp), ...shownLiteralsOf(compiler, node.falseExp)];
  if (node instanceof compiler.Binary && ['+', '??', '||'].includes(node.operation))
    return [...shownLiteralsOf(compiler, node.left), ...shownLiteralsOf(compiler, node.right)];
  if (node instanceof compiler.Interpolation)
    return [...node.strings, ...node.expressions.flatMap((expression) => shownLiteralsOf(compiler, expression))];
  if (node instanceof compiler.TemplateLiteral)
    return [
      ...node.elements.map((element) => element.text),
      ...node.expressions.flatMap((expression) => shownLiteralsOf(compiler, expression)),
    ];

  return [];
};

const literalTextsOf = (compiler: Compiler, options: { template: string; file: string }) => {
  const { template, file } = options;
  const found: string[] = [];
  const shown = (texts: string[]) => found.push(...texts.map((text) => text.trim()).filter(hasLetter));

  class Visitor extends compiler.TmplAstRecursiveVisitor {
    override visitText(text: InstanceType<Compiler['TmplAstText']>) {
      shown([text.value]);
    }

    override visitBoundText(text: InstanceType<Compiler['TmplAstBoundText']>) {
      shown(shownLiteralsOf(compiler, text.value));
    }

    override visitTextAttribute(attribute: InstanceType<Compiler['TmplAstTextAttribute']>) {
      if (VISIBLE_ATTRIBUTES.has(attribute.name)) shown([attribute.value]);
    }

    override visitBoundAttribute(attribute: InstanceType<Compiler['TmplAstBoundAttribute']>) {
      if (VISIBLE_ATTRIBUTES.has(attribute.name)) shown(shownLiteralsOf(compiler, attribute.value));
    }
  }

  compiler.tmplAstVisitAll(new Visitor(), compiler.parseTemplate(template, file, { preserveWhitespaces: false }).nodes);

  return found;
};

const textRefusalsOf = async (options: { root: string; component: string }) => {
  const { root, component } = options;
  const compiler = await angularCompilerOf();

  if (compiler === null)
    return [`NO-COMPILER ${component}: @angular/compiler is not installed, so its texts cannot be read`];

  const folder = posix.dirname(component);
  const files = [
    component,
    ...Object.keys(appFilesOf({ root, component })).filter(
      (file) => file !== component && posix.dirname(file) === folder && file.endsWith('.ts'),
    ),
  ];

  return files.flatMap((file) => {
    const template = existsSync(resolve(root, file)) ? componentTemplateOf(resolve(root, file)) : null;
    const texts = template === null ? [] : literalTextsOf(compiler, { template, file });

    return texts.length > 0
      ? [
          `LITERAL-TEXT ${file}: ${texts.map((text) => JSON.stringify(text)).join(', ')} - read user-visible text from the product's label map`,
        ]
      : [];
  });
};

/**
 * Why a part's app component may not be recorded as implemented: no spec in its folder that renders it with data
 * other than the design's fixture, or user-visible literal text in its templates instead of label-map bindings.
 */
export const implementedRefusalsOf: ImplementedRefusals = async (options) => [
  ...specRefusalsOf(options),
  ...(await textRefusalsOf(options)),
];
