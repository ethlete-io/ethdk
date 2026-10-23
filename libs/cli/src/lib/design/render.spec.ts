import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { mountDrawing, unseenStyles } from '../../../design/define-call';
import { isStale } from './render';
import { entryOf, extractRender, lookupImports, mappedSubpathOf, mapPackage, typePathsOf } from './render-packages';

const packages = { '@ethlete/*': 'dist/libs/*', 'exact-pkg': 'vendor/exact' };

describe('mapPackage', () => {
  it('maps a scoped wildcard to the checkout folder and keeps the subpath', () => {
    expect(mapPackage({ specifier: '@ethlete/core', packages, target: '/repo' })).toEqual({
      dir: '/repo/dist/libs/core',
      subpath: '.',
    });
    expect(mapPackage({ specifier: '@ethlete/components/design/button', packages, target: '/repo' })).toEqual({
      dir: '/repo/dist/libs/components',
      subpath: './design/button',
    });
  });

  it('maps an exact package name', () => {
    expect(mapPackage({ specifier: 'exact-pkg/sub', packages, target: '/repo' })).toEqual({
      dir: '/repo/vendor/exact',
      subpath: './sub',
    });
  });

  it('leaves everything else to Node', () => {
    expect(mapPackage({ specifier: '@angular/core', packages, target: '/repo' })).toBeNull();
    expect(mapPackage({ specifier: './fixture', packages, target: '/repo' })).toBeNull();
    expect(mapPackage({ specifier: 'exact-pkg-two', packages, target: '/repo' })).toBeNull();
  });
});

describe('entryOf', () => {
  const makePackage = (manifest: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-render-'));

    mkdirSync(join(dir, 'fesm2022'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest), 'utf8');

    return dir;
  };

  it('reads the default condition of an export, and a pattern export', () => {
    const dir = makePackage({
      exports: {
        '.': { types: './index.d.ts', default: './fesm2022/pkg.mjs' },
        './design/*': './design/*.ts',
      },
    });

    expect(entryOf({ dir, subpath: '.' })).toBe(join(dir, 'fesm2022/pkg.mjs'));
    expect(entryOf({ dir, subpath: './design/button' })).toBe(join(dir, 'design/button.ts'));
  });

  it('falls back to module for the root, and names a missing export or build', () => {
    const dir = makePackage({ module: './fesm2022/pkg.mjs' });

    expect(entryOf({ dir, subpath: '.' })).toBe(join(dir, 'fesm2022/pkg.mjs'));
    expect(() => entryOf({ dir, subpath: './nope' })).toThrow('exports no "./nope"');
    expect(() => entryOf({ dir: join(dir, 'missing'), subpath: '.' })).toThrow('build the package first');
  });
});

describe('typePathsOf', () => {
  it('types the root import of every built package a wildcard maps', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-render-'));

    mkdirSync(join(target, 'dist/libs/core'), { recursive: true });
    mkdirSync(join(target, 'dist/libs/unbuilt'), { recursive: true });
    writeFileSync(
      join(target, 'dist/libs/core/package.json'),
      JSON.stringify({ exports: { '.': { types: './types/core.d.ts' } } }),
      'utf8',
    );

    expect(typePathsOf({ packages: { '@ethlete/*': 'dist/libs/*' }, target })).toEqual({
      '@ethlete/core': [join(target, 'dist/libs/core/types/core.d.ts')],
    });
  });
});

describe('subpaths of a mapped package', () => {
  const builtCore = () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-render-'));

    mkdirSync(join(target, 'dist/libs/core'), { recursive: true });
    writeFileSync(
      join(target, 'dist/libs/core/package.json'),
      JSON.stringify({
        exports: {
          './design/*': './design/*.ts',
          './package.json': { default: './package.json' },
          '.': { types: './types/core.d.ts', default: './fesm2022/core.mjs' },
          './testing': { types: './types/testing.d.ts', default: './fesm2022/testing.mjs' },
        },
      }),
      'utf8',
    );

    return target;
  };

  it('types every exported subpath from the mapped folder', () => {
    const target = builtCore();

    expect(typePathsOf({ packages: { '@ethlete/*': 'dist/libs/*' }, target })).toEqual({
      '@ethlete/core': [join(target, 'dist/libs/core/types/core.d.ts')],
      '@ethlete/core/design/*': [join(target, 'dist/libs/core/design/*.ts')],
      '@ethlete/core/testing': [join(target, 'dist/libs/core/types/testing.d.ts')],
    });
  });

  it('loads a subpath import from the mapped folder and leaves the root to the checkout', () => {
    const target = builtCore();
    const packages = { '@ethlete/*': 'dist/libs/*' };

    expect(mappedSubpathOf({ specifier: '@ethlete/core/design/theme-css', packages, target })).toBe(
      join(target, 'dist/libs/core/design/theme-css.ts'),
    );
    expect(mappedSubpathOf({ specifier: '@ethlete/core', packages, target })).toBeNull();
    expect(mappedSubpathOf({ specifier: '@ethlete/core/nope', packages, target })).toBeNull();
    expect(mappedSubpathOf({ specifier: '@angular/core/testing', packages, target })).toBeNull();
  });
});

describe('lookupImports', () => {
  const modules = { '@ethlete/components': { BUTTON_IMPORTS: 'button' }, extra: { CHART: 'chart' } };

  it('finds each name in the first module that exports it', () => {
    expect(lookupImports({ names: ['BUTTON_IMPORTS', 'CHART'], modules })).toEqual(['button', 'chart']);
  });

  it('names an unknown import and the modules it searched', () => {
    expect(() => lookupImports({ names: ['NOPE_IMPORTS'], modules })).toThrow(
      'no import "NOPE_IMPORTS" in @ethlete/components, extra',
    );
  });
});

describe('extractRender', () => {
  it('takes the host markup without container comments, and every style', () => {
    const document =
      '<html><head><style ng-app-id="ng">.a{}</style><style>.b{}</style></head>' +
      '<body><et-design-host ng-server-context="ssr"><p>x</p><!--container--></et-design-host></body></html>';

    expect(extractRender(document)).toEqual({ markup: '<p>x</p>', styles: ['.a{}', '.b{}'] });
  });

  it('appends what the app attached to the body after the host, shown and without scripts', () => {
    const document =
      '<html><head></head><body><et-design-host><b aria-controls="l-1">x</b></et-design-host>' +
      '<div class="et-overlay-runtime-root"><div class="et-overlay et-force-invisible et-overlay--anchored">' +
      '<div id="l-1">panel</div><!--container--></div></div><script id="ng-state">{}</script></body></html>';

    expect(extractRender(document).markup).toBe(
      '<b aria-controls="l-1">x</b><div class="et-overlay-runtime-root">' +
        '<div class="et-overlay et-overlay--anchored"><div id="l-1">panel</div></div></div>',
    );
  });
});

describe('unseenStyles', () => {
  it('emits a style once per frame', () => {
    const seen = new Set<string>();

    expect(unseenStyles(['.a{}', '.b{}', '.a{}'], seen)).toBe('<style>.a{}</style><style>.b{}</style>');
    expect(unseenStyles(['.b{}', '.c{}'], seen)).toBe('<style>.c{}</style>');
  });
});

describe('isStale', () => {
  it('is stale once a loaded file has another mtime', () => {
    const mtimes: Record<string, number> = { '/a.mjs': 1, '/b.mjs': 2 };
    const mtime = (path: string) => mtimes[path] ?? -1;

    expect(isStale({ '/a.mjs': 1, '/b.mjs': 2 }, mtime)).toBe(false);
    expect(isStale({ '/a.mjs': 1, '/b.mjs': 3 }, mtime)).toBe(true);
    expect(isStale({ '/gone.mjs': 1 }, mtime)).toBe(true);
  });
});

describe('mountDrawing', () => {
  it('runs setup once the markup is in the root, and returns its error', () => {
    const root = { innerHTML: '' } as HTMLElement;
    const seen: string[] = [];

    expect(mountDrawing(root, { body: '<b>x</b>', styles: '', setup: (r) => seen.push(r.innerHTML) })).toBeNull();
    expect(seen).toEqual(['<b>x</b>']);

    const thrown = new Error('boom');

    expect(
      mountDrawing(root, {
        body: '',
        styles: '',
        setup: () => {
          throw thrown;
        },
      }),
    ).toBe(thrown);
  });

  it('runs a list of setups in order and stops at the first that throws', () => {
    const root = { innerHTML: '' } as HTMLElement;
    const calls: string[] = [];
    const thrown = new Error('boom');

    expect(
      mountDrawing(root, { body: '', styles: '', setup: [() => calls.push('a'), () => calls.push('b')] }),
    ).toBeNull();
    expect(calls).toEqual(['a', 'b']);

    calls.length = 0;

    expect(
      mountDrawing(root, {
        body: '',
        styles: '',
        setup: [
          () => calls.push('a'),
          () => {
            throw thrown;
          },
          () => calls.push('c'),
        ],
      }),
    ).toBe(thrown);
    expect(calls).toEqual(['a']);
  });
});
