import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideOverlay } from '@ethlete/components';
import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { provideQueryDevtools } from '@ethlete/query';
import { routes } from './app.routes';
import { APP_COLOR_THEMES, APP_SURFACE_THEMES } from './themes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideOverlay(),
    ...provideSurfaceThemesWithTailwind4(APP_SURFACE_THEMES),
    ...provideColorThemesWithTailwind4(APP_COLOR_THEMES),
    provideQueryDevtools({
      apiEnvs: [
        {
          name: 'App API',
          storageKey: 'appApiEnv',
          fallback: 'local',
          envs: [
            { id: 'local', url: '/api/local' },
            { id: 'production', url: '/api/production', production: true },
          ],
        },
      ],
    }),
  ],
};
