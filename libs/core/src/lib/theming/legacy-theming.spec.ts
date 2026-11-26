import { createRootThemeCss, createThemeStyle } from './legacy-theming';
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
});
