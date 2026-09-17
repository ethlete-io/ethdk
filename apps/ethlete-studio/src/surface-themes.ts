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

export const DARK_SURFACE: SurfaceTheme = {
  name: 'dark',
  type: 'dark',
  elevation: 0,
  isDefault: true,
  interactionColor: DARK_INTERACTION,
  background: '23 23 23',
  color: '235 235 235',
  colorMuted: '150 150 150',
  colorSubtle: '115 115 115',
  border: '48 48 48',
};

export const DARK_ELEVATED_SURFACE: SurfaceTheme = {
  name: 'dark-elevated',
  type: 'dark',
  elevation: 1,
  interactionColor: DARK_INTERACTION,
  background: '32 32 32',
  color: '235 235 235',
  colorMuted: '150 150 150',
  colorSubtle: '115 115 115',
  border: '58 58 58',
};

export const DARK_ELEVATED_2_SURFACE: SurfaceTheme = {
  name: 'dark-elevated-2',
  type: 'dark',
  elevation: 2,
  interactionColor: DARK_INTERACTION,
  background: '42 42 42',
  color: '235 235 235',
  colorMuted: '150 150 150',
  colorSubtle: '115 115 115',
  border: '70 70 70',
};

export const SURFACE_THEMES = [DARK_SURFACE, DARK_ELEVATED_SURFACE, DARK_ELEVATED_2_SURFACE];
