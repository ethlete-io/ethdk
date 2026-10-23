import type { ThemeCssColorTheme, ThemeCssSurfaceTheme } from '@ethlete/core/design/theme-css';

export const SURFACE_THEMES: ThemeCssSurfaceTheme[] = [
  {
    name: 'light',
    type: 'light',
    elevation: 0,
    isDefault: true,
    background: '255 255 255',
    color: '23 23 23',
    colorMuted: '82 82 82',
    colorSubtle: '163 163 163',
    border: '229 229 229',
  },
  {
    name: 'dark',
    type: 'dark',
    elevation: 0,
    isDefault: true,
    background: '23 23 23',
    color: '245 245 245',
    colorMuted: '163 163 163',
    colorSubtle: '115 115 115',
    border: '64 64 64',
  },
];

export const COLOR_THEMES: ThemeCssColorTheme[] = [
  {
    name: 'brand',
    isDefault: true,
    primary: {
      color: { default: '37 99 235', hover: '29 78 216', active: '30 64 175', disabled: '147 197 253' },
      onColor: { default: '255 255 255' },
    },
  },
];
