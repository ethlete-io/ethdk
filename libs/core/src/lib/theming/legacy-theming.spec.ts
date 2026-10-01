import { createRootThemeCss, createSwatchCss, createTailwindColorThemes, createThemeStyle } from './legacy-theming';
import { ColorTheme, ThemeSwatch } from './color-theme.util';

const swatch: ThemeSwatch = {
  color: { default: '1 2 3', hover: '1 2 3', active: '1 2 3', disabled: '1 2 3' },
  onColor: { default: '4 5 6' },
};

const THEME: ColorTheme = { name: 'primary', primary: swatch };

describe('legacy theming', () => {
  afterEach(() => {
    document.head.querySelectorAll('style').forEach((style) => style.remove());
    document.body.replaceChildren();
  });

  it('should carry the ngCspNonce of the page on the stylesheets it injects', () => {
    const root = document.createElement('div');
    root.setAttribute('ngCspNonce', 'from-the-page');
    document.body.append(root);

    createRootThemeCss([THEME]);
    createThemeStyle(THEME, false);

    expect(document.getElementById('et-root-themes')?.getAttribute('nonce')).toBe('from-the-page');
    expect(document.getElementById('et-color--primary')?.getAttribute('nonce')).toBe('from-the-page');
  });

  it('should inject the stylesheets without a nonce when the page has none', () => {
    createRootThemeCss([THEME]);

    expect(document.getElementById('et-root-themes')?.hasAttribute('nonce')).toBe(false);
  });

  describe('inkColorBySurfaceType', () => {
    const SURFACE_INK_THEME: ColorTheme = {
      name: 'alert',
      primary: { ...swatch, inkColorBySurfaceType: { light: { default: '7 8 9', hover: '10 11 12' } } },
    };

    it('should emit the per-type ink next to the plain ink of the swatch', () => {
      const css = createSwatchCss('primary', false, SURFACE_INK_THEME.primary);

      expect(css).toContain('--et-color-primary-ink-light: 7 8 9;');
      expect(css).toContain('--et-color-primary-ink-light-focus: 10 11 12;');
      expect(css).toContain('--et-color-primary-ink-light-disabled: 7 8 9;');
      expect(css).not.toContain('-ink-dark');
    });

    it('should inject the reset and the surface switch only when a theme sets it', () => {
      createRootThemeCss([THEME]);
      expect(document.getElementById('et-root-themes')?.textContent).not.toContain('--_et-color-ink');

      createRootThemeCss([THEME, SURFACE_INK_THEME]);
      const css = document.getElementById('et-root-themes')?.textContent ?? '';

      expect(css).toContain('--et-color-primary-ink-light: initial;');
      expect(css).toContain('--_et-color-ink-light: var(--et-surface-if-light) var(--et-color-primary-ink-light);');
      expect(css).toContain(":where([class*='et-surface--'])");
    });

    it('should add a Tailwind 3 ink color per surface type', () => {
      const colors = createTailwindColorThemes([SURFACE_INK_THEME]);

      expect(colors['et-alert-ink-light']?.DEFAULT).toBe('rgb(7 8 9 / <alpha-value>)');
      expect(colors['et-alert-ink-dark']).toBeUndefined();
    });
  });
});
