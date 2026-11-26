import { ColorTheme, provideColorThemesWithTailwind4 } from './color-theme.util';
import { provideSurfaceThemesWithTailwind4, SurfaceTheme } from './surface-theme.util';

const surface = (name: string, type: 'light' | 'dark', isDefault = false): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  isDefault,
  background: '0 0 0',
  color: '0 0 0',
  colorMuted: '0 0 0',
  colorSubtle: '0 0 0',
  border: '0 0 0',
});

const color = (name: string, isDefault = false) => ({ name, isDefault }) as unknown as ColorTheme;

describe('duplicate default themes', () => {
  it('throws ET9201 naming both surfaces when two share a type', () => {
    expect(() => provideSurfaceThemesWithTailwind4([surface('a', 'light', true), surface('b', 'light', true)])).toThrow(
      /ET9201.*"a" and "b"/,
    );
  });

  it('allows one default per surface type', () => {
    expect(() =>
      provideSurfaceThemesWithTailwind4([surface('a', 'light', true), surface('b', 'dark', true)]),
    ).not.toThrow();
  });

  it('throws ET9200 naming both color themes', () => {
    expect(() => provideColorThemesWithTailwind4([color('x', true), color('y', true)])).toThrow(/ET9200.*"x" and "y"/);
  });

  it('allows a single default color theme', () => {
    expect(() => provideColorThemesWithTailwind4([color('x', true), color('y')])).not.toThrow();
  });

  describe('production mode', () => {
    const g = globalThis as { ngDevMode?: unknown };
    const original = g.ngDevMode;

    beforeEach(() => {
      g.ngDevMode = false;
    });
    afterEach(() => {
      g.ngDevMode = original;
    });

    it('does not throw', () => {
      expect(() =>
        provideSurfaceThemesWithTailwind4([surface('a', 'light', true), surface('b', 'light', true)]),
      ).not.toThrow();
      expect(() => provideColorThemesWithTailwind4([color('x', true), color('y', true)])).not.toThrow();
    });
  });
});
