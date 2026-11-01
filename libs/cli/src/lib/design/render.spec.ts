import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { mountDrawing, unseenStyles } from '../../../design/define-call';
import { forceMiddleware, isStale, renderMiddleware } from './render';
import {
  entryOf,
  entryOfBuilt,
  entryOfBuiltAsync,
  extractRender,
  lookupImports,
  mappedSubpathOf,
  mapPackage,
  typePathsOf,
} from './render-packages';

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

describe('entryOfBuilt', () => {
  const manifest = JSON.stringify({ exports: { '.': './fesm2022/pkg.mjs' } });

  const clock = () => {
    let time = 0;

    return { now: () => time, sleep: (ms: number) => void (time += ms) };
  };

  it('waits for a package.json that a build writes later', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'cli-render-')), 'pkg');
    const { now, sleep } = clock();
    const waits: string[] = [];
    const entry = entryOfBuilt(
      { dir, subpath: '.' },
      {
        now,
        onWait: (waiting) => waits.push(waiting),
        sleep: (ms) => {
          sleep(ms);

          if (now() >= 2000) {
            mkdirSync(join(dir, 'fesm2022'), { recursive: true });
            writeFileSync(join(dir, 'package.json'), manifest, 'utf8');
            writeFileSync(join(dir, 'fesm2022/pkg.mjs'), '', 'utf8');
          }
        },
      },
    );

    expect(entry).toBe(join(dir, 'fesm2022/pkg.mjs'));
    expect(waits).toEqual([dir]);
  });

  it('waits for an entry file the manifest points to before it exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-render-'));
    const { now, sleep } = clock();

    writeFileSync(join(dir, 'package.json'), manifest, 'utf8');
    mkdirSync(join(dir, 'fesm2022'));

    entryOfBuilt(
      { dir, subpath: '.' },
      {
        now,
        onWait: () => undefined,
        sleep: (ms) => {
          sleep(ms);
          writeFileSync(join(dir, 'fesm2022/pkg.mjs'), '', 'utf8');
        },
      },
    );

    expect(existsSync(join(dir, 'fesm2022/pkg.mjs'))).toBe(true);
  });

  it('throws the missing-package error once the timeout passes', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'cli-render-')), 'missing');
    const { now, sleep } = clock();

    expect(() => entryOfBuilt({ dir, subpath: '.' }, { now, sleep, onWait: () => undefined })).toThrow(
      'build the package first',
    );
    expect(now()).toBe(60_000);
  });

  it('polls without blocking when async', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'cli-render-')), 'pkg');

    setTimeout(() => {
      mkdirSync(join(dir, 'fesm2022'), { recursive: true });
      writeFileSync(join(dir, 'package.json'), manifest, 'utf8');
      writeFileSync(join(dir, 'fesm2022/pkg.mjs'), '', 'utf8');
    }, 30);

    await expect(entryOfBuiltAsync({ dir, subpath: '.' }, { intervalMs: 10, onWait: () => undefined })).resolves.toBe(
      join(dir, 'fesm2022/pkg.mjs'),
    );
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

  it('loads a subpath import from the mapped folder and leaves the root to the checkout', async () => {
    const target = builtCore();
    const packages = { '@ethlete/*': 'dist/libs/*' };

    mkdirSync(join(target, 'dist/libs/core/design'));
    writeFileSync(join(target, 'dist/libs/core/design/theme-css.ts'), '', 'utf8');

    expect(await mappedSubpathOf({ specifier: '@ethlete/core/design/theme-css', packages, target })).toBe(
      join(target, 'dist/libs/core/design/theme-css.ts'),
    );
    expect(await mappedSubpathOf({ specifier: '@ethlete/core', packages, target })).toBeNull();
    expect(await mappedSubpathOf({ specifier: '@ethlete/core/nope', packages, target })).toBeNull();
    expect(await mappedSubpathOf({ specifier: '@angular/core/testing', packages, target })).toBeNull();
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

const post = (body: string, middleware: (request: IncomingMessage, response: ServerResponse) => void) =>
  new Promise<{ status: number; body: string }>((settle) => {
    const request = Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST' }) as unknown as IncomingMessage;
    const response = {
      statusCode: 200,
      setHeader: () => undefined,
      end: (text = '') => settle({ status: response.statusCode, body: text }),
    };

    middleware(request, response as unknown as ServerResponse);
  });

describe('forcing interactions in the CSS a frame receives', () => {
  const forced = '.x:is(:hover, [data-et-force~="hover"]:not(:disabled, [disabled], [aria-disabled="true"])){}';

  it('rewrites the component styles of a render', async () => {
    const answered = await post(
      '{}',
      renderMiddleware(async () => ({ markup: '<b></b>', styles: ['.x:hover{}'] })),
    );

    expect(JSON.parse(answered.body)).toEqual({ markup: '<b></b>', styles: [forced] });
  });

  it('rewrites posted CSS, the styles of a drawing', async () => {
    expect(await post('.x:hover{}', forceMiddleware)).toEqual({ status: 200, body: forced });
  });
});
