import { SurfaceTheme } from '@ethlete/core';

const FARN_INTERACTION = {
  tint: '86 100 88',
  controlText: {
    default: '86 100 88',
    hover: '34 48 38',
    focus: '34 48 38',
    active: '34 48 38',
    disabled: '160 168 156',
  },
} satisfies Pick<SurfaceTheme, 'tint' | 'controlText'>;

export const FARN_SURFACE: SurfaceTheme = {
  name: 'farn' as SurfaceTheme['name'],
  isDefault: true,
  type: 'light',
  elevation: 0,
  ...FARN_INTERACTION,
  background: '247 243 233',
  color: '34 48 38',
  colorMuted: '86 100 88',
  colorSubtle: '112 124 110',
  border: '218 212 196',
};

export const SURFACE_THEMES = [FARN_SURFACE];
