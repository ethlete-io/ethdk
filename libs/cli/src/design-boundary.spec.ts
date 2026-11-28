import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, sep } from 'path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

const COMMAND_WIRING_SPECIFIER = '@ethlete/design';
const COMMAND_WIRING_NAME = 'designCommand';

const NON_LITERAL_LOADS_ALLOWED = new Set<string>([
  'design/src/lib/design/browser.ts',
  'design/src/lib/design/commit-hunks.ts',
  'design/src/lib/design/render-worker.ts',
  'design/src/lib/design/serve.ts',
]);

const isInside = (dir: string, path: string) => path === dir || path.startsWith(`${dir}${sep}`);

const sourceFiles = (root: string) =>
  (readdirSync(root, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(root, name));

const cliCompilerOptions = (() => {
  const path = join(__dirname, '..', 'tsconfig.lib.json');
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(path, ts.sys.readFile).config, ts.sys, dirname(path));

  return config.options;
})();

interface Layout {
  root: string;
  options: ts.CompilerOptions;
}

const designDirOf = (layout: Layout) => join(layout.root, 'design', 'src');
const cliIndexOf = (layout: Layout) => join(layout.root, 'cli', 'src', 'index.ts');

interface Load {
  specifier: string | null;
  names: string[] | 'all';
}

const loadsOf = (file: string): Load[] => {
  const loads: Load[] = [];
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const bindings = node.importClause?.namedBindings;
      const namedOnly = !node.importClause?.name && bindings && ts.isNamedImports(bindings);

      loads.push({
        specifier: node.moduleSpecifier.text,
        names: namedOnly ? bindings.elements.map((element) => (element.propertyName ?? element.name).text) : 'all',
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      loads.push({ specifier: node.moduleSpecifier.text, names: 'all' });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      loads.push({ specifier: node.moduleReference.expression.text, names: 'all' });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const [argument] = node.arguments;

      loads.push({ specifier: argument && ts.isStringLiteralLike(argument) ? argument.text : null, names: 'all' });
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      loads.push({
        specifier: ts.isStringLiteral(node.argument.literal) ? node.argument.literal.text : null,
        names: 'all',
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return loads;
};

const resolutionCaches = new WeakMap<Layout, ts.ModuleResolutionCache>();

const resolutionCacheOf = (layout: Layout) => {
  const cached = resolutionCaches.get(layout);

  if (cached) return cached;

  const made = ts.createModuleResolutionCache(layout.root, (name) => name, layout.options);

  resolutionCaches.set(layout, made);

  return made;
};

const resolvedTarget = (layout: Layout, file: string, specifier: string) => {
  const resolved = ts.resolveModuleName(
    specifier,
    file,
    layout.options,
    ts.sys,
    resolutionCacheOf(layout),
  ).resolvedModule;

  if (resolved) return resolved.resolvedFileName.split('/').join(sep);

  return specifier.startsWith('.') ? join(dirname(file), specifier) : null;
};

const localLoadsCaches = new WeakMap<Layout, Map<string, LocalLoad[]>>();

interface LocalLoad extends Load {
  target: string | null;
  unresolvable: boolean;
}

const localLoadsOf = (layout: Layout, file: string): LocalLoad[] => {
  const cache = localLoadsCaches.get(layout) ?? new Map<string, LocalLoad[]>();

  localLoadsCaches.set(layout, cache);

  const cached = cache.get(file);

  if (cached) return cached;

  const loads = uncachedLocalLoadsOf(layout, file);

  cache.set(file, loads);

  return loads;
};

const uncachedLocalLoadsOf = (layout: Layout, file: string): LocalLoad[] =>
  loadsOf(file).flatMap((load): LocalLoad[] => {
    if (load.specifier === null) return [{ ...load, target: null, unresolvable: true }];

    const target = resolvedTarget(layout, file, load.specifier);

    return target && !target.includes(`${sep}node_modules${sep}`) ? [{ ...load, target, unresolvable: false }] : [];
  });

const describeRow = (layout: Layout, file: string, specifier: string | null) =>
  `${relative(layout.root, file)} -> ${specifier ?? '<non-literal import()/require()>'}`;

const nonLiteralOffenders = (layout: Layout, files: string[]) =>
  files
    .filter((file) => !NON_LITERAL_LOADS_ALLOWED.has(relative(layout.root, file)))
    .flatMap((file) =>
      localLoadsOf(layout, file)
        .filter((load) => load.unresolvable)
        .map(() => describeRow(layout, file, null)),
    );

const outsideImportsOfDesign = (layout: Layout, files: string[]) =>
  files
    .filter((file) => !isInside(designDirOf(layout), file))
    .flatMap((file) => localLoadsOf(layout, file).map((load) => ({ file, ...load })))
    .filter(({ target }) => target !== null && isInside(designDirOf(layout), target))
    .filter(
      ({ file, specifier, names }) =>
        !(
          file === cliIndexOf(layout) &&
          specifier === COMMAND_WIRING_SPECIFIER &&
          names !== 'all' &&
          names.length === 1 &&
          names[0] === COMMAND_WIRING_NAME
        ),
    )
    .map(({ file, specifier }) => describeRow(layout, file, specifier));

const designWritesBypassingJournal = (layout: Layout, files: string[]) =>
  files
    .filter(
      (file) =>
        isInside(designDirOf(layout), file) &&
        file !== join(designDirOf(layout), 'lib', 'design', 'system', 'design-file.ts'),
    )
    .flatMap((file) => localLoadsOf(layout, file).map((load) => ({ file, ...load })))
    .filter(({ target }) => target === join(layout.root, 'cli-core', 'src', 'lib', 'json-file.ts'))
    .map(({ file, specifier }) => describeRow(layout, file, specifier));

const fixtureLayout = (files: Record<string, string>): Layout => {
  const root = mkdtempSync(join(tmpdir(), 'design-boundary-'));

  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }

  return {
    root,
    options: {
      ...cliCompilerOptions,
      baseUrl: root,
      paths: {
        '@ethlete/cli/sketch-frames': ['design/src/lib/design/frames.ts'],
        '@ethlete/cli-core/*': ['cli-core/src/lib/*'],
        '@ethlete/design': ['design/src/index.ts'],
      },
    },
  };
};

describe('the boundary between libs/cli, libs/cli-core and libs/design', () => {
  const layout: Layout = { root: join(__dirname, '..', '..'), options: cliCompilerOptions };
  const files = [
    ...sourceFiles(join(layout.root, 'cli', 'src')),
    ...sourceFiles(join(layout.root, 'cli-core', 'src')),
    ...sourceFiles(designDirOf(layout)),
  ];

  it('keeps CLI and CLI core files from importing design, except the et design command wiring', () => {
    expect(outsideImportsOfDesign(layout, files)).toEqual([]);
  });

  it('sends every design write through design-file, so the write journal sees it', () => {
    expect(designWritesBypassingJournal(layout, files)).toEqual([]);
  });

  it('has no import() or require() whose target is computed, so no load can slip past the two checks', () => {
    expect(nonLiteralOffenders(layout, files)).toEqual([]);
  });
});

describe('the design boundary checks', () => {
  const fixtures: Layout[] = [];
  const fixture = (files: Record<string, string>) => {
    const made = fixtureLayout(files);

    fixtures.push(made);

    return { layout: made, files: sourceFiles(made.root) };
  };

  afterAll(() => fixtures.forEach(({ root }) => rmSync(root, { recursive: true, force: true })));

  const designFiles = {
    'design/src/index.ts': "export { designCommand } from './lib/design';",
    'design/src/lib/design/index.ts': 'export const designCommand = 1;',
    'design/src/lib/design/frames.ts': 'export {};',
  };

  it('catches a path alias that resolves inside design', () => {
    const { layout, files } = fixture({
      ...designFiles,
      'cli/src/lib/core.ts': "import { x } from '@ethlete/cli/sketch-frames';",
    });

    expect(outsideImportsOfDesign(layout, files)).toEqual(['cli/src/lib/core.ts -> @ethlete/cli/sketch-frames']);
  });

  it('catches a .js specifier that resolves to json-file.ts', () => {
    const { layout, files } = fixture({
      ...designFiles,
      'cli-core/src/lib/json-file.ts': 'export {};',
      'design/src/lib/design/system/writer.ts': "import '@ethlete/cli-core/json-file.js';",
    });

    expect(designWritesBypassingJournal(layout, files)).toEqual([
      'design/src/lib/design/system/writer.ts -> @ethlete/cli-core/json-file.js',
    ]);
  });

  it('lets index.ts import only designCommand from design', () => {
    const wiring = (text: string) => fixture({ ...designFiles, 'cli/src/index.ts': text });
    const rowsOf = (text: string) => {
      const { layout, files } = wiring(text);

      return outsideImportsOfDesign(layout, files);
    };

    expect(rowsOf("import { designCommand } from '@ethlete/design';")).toEqual([]);
    expect(rowsOf("export * from '@ethlete/design';")).toHaveLength(1);
    expect(rowsOf("import * as design from '@ethlete/design';")).toHaveLength(1);
    expect(rowsOf("import { designCommand, other } from '@ethlete/design';")).toHaveLength(1);
  });

  it('catches an import() or require() that design is loaded through, and rejects a computed one', () => {
    const { layout, files } = fixture({
      ...designFiles,
      'cli/src/lib/literal.ts': "export const a = () => import('@ethlete/design');",
      'cli/src/lib/required.ts': "export const b = require('../../../design/src/lib/design/frames');",
      'cli/src/lib/computed.ts': "export const c = () => import('./' + 'design');",
    });

    expect(outsideImportsOfDesign(layout, files).sort()).toEqual([
      'cli/src/lib/literal.ts -> @ethlete/design',
      'cli/src/lib/required.ts -> ../../../design/src/lib/design/frames',
    ]);
    expect(nonLiteralOffenders(layout, files)).toEqual(['cli/src/lib/computed.ts -> <non-literal import()/require()>']);
  });
});
