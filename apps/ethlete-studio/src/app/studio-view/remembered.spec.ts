import {
  camerasWith,
  frameSizesOf,
  frameSizesWith,
  rememberTheme,
  rememberedView,
  rememberView,
  themeName,
} from './remembered';

const KEY = 'ethlete-studio.call-view';

describe('remembered view', () => {
  afterEach(() => localStorage.clear());

  it('reads nothing from missing or corrupt storage', () => {
    expect(rememberedView()).toEqual({});

    localStorage.setItem(KEY, 'not json');
    expect(rememberedView()).toEqual({});

    localStorage.setItem(KEY, '"text"');
    expect(rememberedView()).toEqual({});
  });

  it('drops fields of the wrong type', () => {
    localStorage.setItem(KEY, JSON.stringify({ checkout: 1, systemProduct: 'web', systemEntry: null }));

    expect(rememberedView()).toEqual({ systemProduct: 'web' });
  });

  it('forgets what the removed calls view kept and leaves the rest', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ checkout: '/a', project: 'p', slug: 's', variant: 'v', chatHidden: true, view: 'calls' }),
    );
    rememberView({ systemProduct: 'web' });

    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ checkout: '/a', systemProduct: 'web' });
  });

  it('remembers which tree groups are open and drops non-boolean flags', () => {
    localStorage.setItem(KEY, JSON.stringify({ openGroups: { legacy: true, 'legacy/pages': 'yes', x: false } }));
    expect(rememberedView().openGroups).toEqual({ legacy: true, x: false });

    localStorage.setItem(KEY, JSON.stringify({ openGroups: 3 }));
    expect(rememberedView().openGroups).toBeUndefined();
  });

  it('merges a patch into what was stored', () => {
    rememberView({ checkout: '/a', systemProduct: 'web' });
    rememberView({ systemProduct: 'app' });

    expect(rememberedView()).toMatchObject({ checkout: '/a', systemProduct: 'app' });
  });

  it('keeps a theme pick per project and drops malformed picks', () => {
    rememberTheme('/a components', { surface: 'dark' });
    rememberTheme('/a components', { color: 'danger' });
    rememberTheme('/b components', { color: 'brand' });

    expect(rememberedView().themes).toEqual({
      '/a components': { surface: 'dark', color: 'danger' },
      '/b components': { color: 'brand' },
    });

    localStorage.setItem(KEY, JSON.stringify({ themes: { x: 3, y: { surface: 1, color: 'c' } } }));
    expect(rememberedView().themes).toEqual({ y: { surface: undefined, color: 'c' } });
  });

  it('falls back to the first theme name when the remembered one is gone', () => {
    expect(themeName(['light', 'dark'], 'dark')).toBe('dark');
    expect(themeName(['light', 'dark'], 'dim')).toBe('light');
    expect(themeName(['light', 'dark'], undefined)).toBe('light');
    expect(themeName([], undefined)).toBeUndefined();
  });

  it('keeps the system entry and only valid cameras', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        systemProduct: 'web',
        systemEntry: 'components/button',
        cameras: {
          'web components/button': { x: 10, y: -4, zoom: 0.5 },
          broken: { x: 1, y: 2, zoom: 0 },
          text: 'camera',
        },
      }),
    );

    expect(rememberedView()).toEqual({
      systemProduct: 'web',
      systemEntry: 'components/button',
      cameras: { 'web components/button': { x: 10, y: -4, zoom: 0.5 } },
    });
  });

  it('stores a camera and drops those of entries that no longer exist', () => {
    const camera = { x: 1, y: 2, zoom: 1 };
    const stored = { kept: { x: 0, y: 0, zoom: 2 }, gone: { x: 3, y: 3, zoom: 1 } };

    expect(camerasWith({ cameras: stored, key: 'new', camera, existing: new Set(['kept', 'new']) })).toEqual({
      kept: stored.kept,
      new: camera,
    });
  });

  it('keeps valid frame sizes and drops the rest', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        frameSizes: { 'a f': { width: 300, height: 'x' }, 'a g': { width: -1 }, 'a h': 'no', 'a i': { height: 200 } },
      }),
    );

    expect(rememberedView().frameSizes).toEqual({ 'a f': { width: 300 }, 'a i': { height: 200 } });
  });

  it('reads and merges the sizes of one canvas', () => {
    const stored = { 'a f': { width: 300 }, 'ab f': { width: 10 } };

    expect(frameSizesOf(stored, 'a')).toEqual({ f: { width: 300 } });

    expect(frameSizesWith({ stored, cameraKey: 'a', frameId: 'f', size: { height: 90 } })['a f']).toEqual({
      width: 300,
      height: 90,
    });
  });
});
