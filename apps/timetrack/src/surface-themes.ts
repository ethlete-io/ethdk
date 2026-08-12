import { SurfaceInteractionColor, SurfaceTheme } from '@ethlete/core';

const DARK_INTERACTION: SurfaceInteractionColor = {
  color: {
    default: '161 161 161',
    hover: '220 220 220',
    focus: '220 220 220',
    active: '250 250 250',
    disabled: '100 100 100',
  },
};

const LIGHT_INTERACTION: SurfaceInteractionColor = {
  color: {
    default: '115 115 115',
    hover: '64 64 64',
    focus: '64 64 64',
    active: '23 23 23',
    disabled: '180 180 180',
  },
};

export const DARK_SURFACE: SurfaceTheme = {
  name: 'dark',
  type: 'dark',
  elevation: 0,
  isDefault: true,
  interactionColor: DARK_INTERACTION,
  background: '20 26 33',
  color: '230 233 239',
  colorMuted: '139 151 168',
  colorSubtle: '106 116 130',
  border: '45 55 68',
};

export const DARK_ELEVATED_SURFACE: SurfaceTheme = {
  name: 'dark-elevated',
  type: 'dark',
  elevation: 1,
  interactionColor: DARK_INTERACTION,
  background: '27 34 43',
  color: '230 233 239',
  colorMuted: '139 151 168',
  colorSubtle: '106 116 130',
  border: '54 65 80',
};

export const DARK_ELEVATED_2_SURFACE: SurfaceTheme = {
  name: 'dark-elevated-2',
  type: 'dark',
  elevation: 2,
  interactionColor: DARK_INTERACTION,
  background: '36 45 56',
  color: '230 233 239',
  colorMuted: '139 151 168',
  colorSubtle: '106 116 130',
  border: '64 77 94',
};

export const LIGHT_SURFACE: SurfaceTheme = {
  name: 'light',
  type: 'light',
  elevation: 0,
  isDefault: true,
  interactionColor: LIGHT_INTERACTION,
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
  interactionColor: LIGHT_INTERACTION,
  background: '250 250 250',
  color: '23 23 23',
  colorMuted: '115 115 115',
  colorSubtle: '161 161 161',
  border: '229 229 229',
};

export const SURFACE_THEMES = [
  DARK_SURFACE,
  DARK_ELEVATED_SURFACE,
  DARK_ELEVATED_2_SURFACE,
  LIGHT_SURFACE,
  LIGHT_ELEVATED_SURFACE,
];
