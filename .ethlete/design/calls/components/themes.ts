import type { ColorTheme, SurfaceTheme } from '@ethlete/core';

export const SURFACE_THEMES: SurfaceTheme[] = [
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

export const COLOR_THEMES: ColorTheme[] = [
  {
    name: 'brand',
    isDefault: true,
    primary: {
      color: { default: '37 99 235', hover: '29 78 216', active: '30 64 175', disabled: '100 116 139' },
      onColor: { default: '255 255 255', disabled: '226 232 240' },
    },
  },
  {
    name: 'danger',
    type: 'error',
    primary: {
      color: { default: '220 38 38', hover: '239 68 68', active: '185 28 28', disabled: '120 52 52' },
      onColor: { default: '255 255 255', disabled: '255 220 220' },
    },
  },
  {
    name: 'warning',
    type: 'warning',
    primary: {
      color: { default: '217 119 6', hover: '245 158 11', active: '180 83 9', disabled: '133 77 14' },
      onColor: { default: '23 23 23', disabled: '255 237 213' },
    },
  },
];
