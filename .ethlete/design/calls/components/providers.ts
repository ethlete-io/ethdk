import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { COLOR_THEMES, SURFACE_THEMES } from './themes';

export default [provideSurfaceThemesWithTailwind4(SURFACE_THEMES), provideColorThemesWithTailwind4(COLOR_THEMES)];
