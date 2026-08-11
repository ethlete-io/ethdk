import { ColorTheme, ThemeColor, ThemeSwatch } from '@ethlete/core';

/**
 * A flat swatch - every interaction state resolves to `color`. For a spec that needs its own theme
 * names (a colour palette, a zone colour) but does not care what the colours are.
 */
export const testColorSwatch = (color: ThemeColor): ThemeSwatch => ({
  color: { default: color, hover: color, focus: color, active: color, disabled: color },
  onColor: { default: '0 0 0' },
});

/**
 * Colour themes for a spec that renders a form control: a default, and one typed `error`. The
 * form-field support layer resolves its validation theme by `type`, so a TestBed missing either
 * dies with `No provider found for InjectionToken Color Themes` before any assertion runs.
 *
 * @example
 * TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });
 */
export const TEST_COLOR_THEMES: ColorTheme[] = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
  {
    name: 'red',
    type: 'error',
    primary: {
      color: {
        default: '255 0 0',
        hover: '255 76 76',
        focus: '255 76 76',
        active: '198 0 0',
        disabled: '128 32 32',
      },
      onColor: {
        default: '0 0 0',
        disabled: '48 0 0',
      },
    },
  },
];

/**
 * One theme per `ColorThemeType`, for a spec asserting that a component resolves the right semantic
 * theme. The names are deliberately not the types - a component must pick a theme by `type`, never
 * by guessing a name.
 */
export const TEST_SEMANTIC_COLOR_THEMES: ColorTheme[] = [
  { name: 'danger', type: 'error', primary: testColorSwatch('220 38 38') },
  { name: 'sunshine', type: 'warning', primary: testColorSwatch('234 179 8') },
  { name: 'grass', type: 'success', primary: testColorSwatch('22 163 74') },
];
