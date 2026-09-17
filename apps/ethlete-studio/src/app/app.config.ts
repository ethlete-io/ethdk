import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { SURFACE_THEMES } from '../surface-themes';
import { THEMES } from '../themes';
import { APP_ROUTES } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // The bundled app is served off `tauri://localhost` as static files, so a path route would 404
    // the moment the webview reloads on one.
    provideRouter(APP_ROUTES, withHashLocation()),
    ...provideColorThemesWithTailwind4(THEMES),
    ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
  ],
};
