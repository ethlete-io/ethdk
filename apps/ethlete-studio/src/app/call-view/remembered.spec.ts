import { rememberTheme, rememberedView, rememberView, themeName } from './remembered';

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
    localStorage.setItem(
      KEY,
      JSON.stringify({ checkout: 1, project: 'p', slug: null, variant: 'v', settledFeature: '', chatHidden: 'yes' }),
    );

    expect(rememberedView()).toEqual({
      checkout: undefined,
      project: 'p',
      slug: undefined,
      variant: 'v',
      settledFeature: '',
    });
  });

  it('merges a patch into what was stored', () => {
    rememberView({ checkout: '/a', project: 'p' });
    rememberView({ project: '' });

    expect(rememberedView()).toMatchObject({ checkout: '/a', project: '' });
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
});
