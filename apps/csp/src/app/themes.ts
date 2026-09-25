import { ColorTheme, SurfaceTheme, ThemeRGBColor } from '@ethlete/core';

const swatch = (color: ThemeRGBColor, onColor: ThemeRGBColor): ColorTheme['primary'] => ({
  color: { default: color, hover: color, focus: color, active: color, disabled: color },
  onColor: { default: onColor, disabled: onColor },
});

export const APP_COLOR_THEMES: ColorTheme[] = [
  { name: 'app-accent', isDefault: true, primary: swatch('37 99 235', '255 255 255') },
  { name: 'app-error', type: 'error', primary: swatch('220 38 38', '255 255 255') },
  { name: 'app-success', type: 'success', primary: swatch('22 163 74', '255 255 255') },
];

const surface = ({
  name,
  elevation,
  background,
}: Pick<SurfaceTheme, 'name' | 'elevation' | 'background'>): SurfaceTheme => ({
  name,
  type: 'light',
  elevation,
  isDefault: elevation === 0,
  interactionColor: {
    color: {
      default: '115 115 115',
      hover: '64 64 64',
      focus: '64 64 64',
      active: '23 23 23',
      disabled: '180 180 180',
    },
  },
  background,
  color: '23 23 23',
  colorMuted: '115 115 115',
  colorSubtle: '161 161 161',
  border: '229 229 229',
});

export const APP_SURFACE_THEMES: SurfaceTheme[] = [
  surface({ name: 'app-base', elevation: 0, background: '255 255 255' }),
  surface({ name: 'app-raised', elevation: 1, background: '245 245 245' }),
];
