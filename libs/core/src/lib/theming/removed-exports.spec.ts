import * as core from '../../index';
import { SurfaceTheme } from './surface-theme.util';

const REMOVED_EXPORTS = [
  'provideColorThemes',
  'createSwatchCss',
  'createRootThemeCss',
  'createThemeStyle',
  'createTailwindCssVar',
  'createTailwindRgbVar',
  'createTailwindColorThemes',
  'injectErrorTheme',
  'injectWarningTheme',
  'injectSuccessTheme',
];

describe('removed theming exports', () => {
  it.each(REMOVED_EXPORTS)('%s is no longer exported from @ethlete/core', (name) => {
    expect(name in core).toBe(false);
  });

  it('SurfaceTheme no longer takes colorTheme or semanticColorThemes', () => {
    const base = {
      name: 'paper',
      type: 'light',
      elevation: 0,
      background: '255 255 255',
      color: '0 0 0',
      colorMuted: '0 0 0',
      colorSubtle: '0 0 0',
      border: '0 0 0',
    } satisfies SurfaceTheme;

    // @ts-expect-error colorTheme is removed, use colorThemeVariants
    const withColorTheme: SurfaceTheme = { ...base, colorTheme: 'brand' };
    // @ts-expect-error semanticColorThemes is removed, use colorThemeVariants
    const withSemantic: SurfaceTheme = { ...base, semanticColorThemes: { error: 'alert' } };

    expect([withColorTheme, withSemantic]).toHaveLength(2);
  });
});
