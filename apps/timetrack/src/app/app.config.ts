import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { SURFACE_THEMES } from '../surface-themes';
import { THEMES } from '../themes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    ...provideColorThemesWithTailwind4(THEMES),
    ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
  ],
};
