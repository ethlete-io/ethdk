import { SurfaceTheme } from '@ethlete/core';

export const LIGHT_SURFACE: SurfaceTheme = {
  name: 'light',
  type: 'light',
  colorTheme: 'brand-on-light',
  elevation: 0,
  isDefault: true,
  semanticColorThemes: { error: 'danger-on-light', success: 'success-on-light', warning: 'warning-on-light' },
  interactionColor: {
    color: {
      default: '115 115 115',
      hover: '64 64 64',
      focus: '64 64 64',
      active: '23 23 23',
      disabled: '180 180 180',
    },
  },
  background: '255 255 255',
  color: '23 23 23',
  colorMuted: '82 82 82',
  colorSubtle: '161 161 161',
  border: '229 229 229',
};

export const LIGHT_ELEVATED_SURFACE: SurfaceTheme = {
  name: 'light-elevated',
  type: 'light',
  colorTheme: 'brand-on-light',
  elevation: 1,
  semanticColorThemes: { error: 'danger-on-light', success: 'success-on-light', warning: 'warning-on-light' },
  interactionColor: {
    color: {
      default: '115 115 115',
      hover: '64 64 64',
      focus: '64 64 64',
      active: '23 23 23',
      disabled: '180 180 180',
    },
  },
  background: '250 250 250',
  color: '23 23 23',
  colorMuted: '82 82 82',
  colorSubtle: '161 161 161',
  border: '229 229 229',
};

export const DARK_SURFACE: SurfaceTheme = {
  name: 'dark',
  type: 'dark',
  colorTheme: 'brand',
  elevation: 0,
  interactionColor: {
    color: {
      default: '161 161 161',
      hover: '220 220 220',
      focus: '220 220 220',
      active: '250 250 250',
      disabled: '100 100 100',
    },
  },
  background: '23 23 23',
  color: '250 250 250',
  colorMuted: '161 161 161',
  colorSubtle: '115 115 115',
  border: '64 64 64',
};

export const DARK_ELEVATED_SURFACE: SurfaceTheme = {
  name: 'dark-elevated',
  type: 'dark',
  colorTheme: 'brand',
  elevation: 1,
  isDefault: true,
  interactionColor: {
    color: {
      default: '161 161 161',
      hover: '220 220 220',
      focus: '220 220 220',
      active: '250 250 250',
      disabled: '100 100 100',
    },
  },
  background: '38 38 38',
  color: '250 250 250',
  colorMuted: '161 161 161',
  colorSubtle: '115 115 115',
  border: '64 64 64',
};

export const DARK_ELEVATED_2_SURFACE: SurfaceTheme = {
  name: 'dark-elevated-2',
  type: 'dark',
  colorTheme: 'brand',
  elevation: 2,
  interactionColor: {
    color: {
      default: '161 161 161',
      hover: '220 220 220',
      focus: '220 220 220',
      active: '250 250 250',
      disabled: '100 100 100',
    },
  },
  background: '64 64 64',
  color: '250 250 250',
  colorMuted: '212 212 212',
  colorSubtle: '115 115 115',
  border: '82 82 82',
};

export const DARK_ELEVATED_3_SURFACE: SurfaceTheme = {
  name: 'dark-elevated-3',
  type: 'dark',
  colorTheme: 'brand',
  elevation: 3,
  interactionColor: {
    color: {
      default: '161 161 161',
      hover: '220 220 220',
      focus: '220 220 220',
      active: '250 250 250',
      disabled: '100 100 100',
    },
  },
  background: '90 90 90',
  color: '250 250 250',
  colorMuted: '212 212 212',
  colorSubtle: '115 115 115',
  border: '110 110 110',
};

export const SURFACE_THEMES = [
  LIGHT_SURFACE,
  LIGHT_ELEVATED_SURFACE,
  DARK_SURFACE,
  DARK_ELEVATED_SURFACE,
  DARK_ELEVATED_2_SURFACE,
  DARK_ELEVATED_3_SURFACE,
];
