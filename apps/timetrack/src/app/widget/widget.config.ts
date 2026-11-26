import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { SURFACE_THEMES } from '../../surface-themes';
import { THEMES } from '../../themes';

/**
 * The floating readout's own providers: the themes, and nothing else.
 *
 * No router, because the window has one view; and deliberately no collector, no tray readout and no
 * nudge. Everything the app window starts on boot would start a second time here, and two of them
 * collecting would write every event twice.
 */
export const widgetConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    ...provideColorThemesWithTailwind4(THEMES),
    ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
  ],
};
