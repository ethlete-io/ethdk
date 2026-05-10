import { SurfaceTheme } from '@ethlete/core';

export const LIGHT_SURFACE: SurfaceTheme = {
  name: 'light',
  type: 'light',
  elevation: 0,
  isDefault: true,
  neutralColor: 'neutral',
  background: '255 255 255',
  color: '23 23 23',
  colorMuted: '115 115 115',
  colorSubtle: '161 161 161',
  border: '229 229 229',
};

export const LIGHT_ELEVATED_SURFACE: SurfaceTheme = {
  name: 'light-elevated',
  type: 'light',
  elevation: 1,
  neutralColor: 'neutral',
  background: '250 250 250',
  color: '23 23 23',
  colorMuted: '115 115 115',
  colorSubtle: '161 161 161',
  border: '229 229 229',
};

export const DARK_SURFACE: SurfaceTheme = {
  name: 'dark',
  type: 'dark',
  elevation: 0,
  neutralColor: 'neutral',
  background: '23 23 23',
  color: '250 250 250',
  colorMuted: '161 161 161',
  colorSubtle: '115 115 115',
  border: '64 64 64',
};

export const DARK_ELEVATED_SURFACE: SurfaceTheme = {
  name: 'dark-elevated',
  type: 'dark',
  elevation: 1,
  isDefault: true,
  neutralColor: 'neutral',
  background: '38 38 38',
  color: '250 250 250',
  colorMuted: '161 161 161',
  colorSubtle: '115 115 115',
  border: '64 64 64',
};

export const DARK_ELEVATED_2_SURFACE: SurfaceTheme = {
  name: 'dark-elevated-2',
  type: 'dark',
  elevation: 2,
  neutralColor: 'neutral',
  background: '64 64 64',
  color: '250 250 250',
  colorMuted: '161 161 161',
  colorSubtle: '115 115 115',
  border: '82 82 82',
};

export const SURFACE_THEMES = [
  LIGHT_SURFACE,
  LIGHT_ELEVATED_SURFACE,
  DARK_SURFACE,
  DARK_ELEVATED_SURFACE,
  DARK_ELEVATED_2_SURFACE,
];
