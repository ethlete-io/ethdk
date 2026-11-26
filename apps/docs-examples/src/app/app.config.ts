import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideOverlay as provideCdkOverlay, provideValidatorErrorsService } from '@ethlete/cdk';
import { provideOverlay } from '@ethlete/components';
import { provideColorScheme, provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { provideQueryDevtools } from '@ethlete/query';
import { THEMES } from './color-themes';
import { injectDocsExample } from './docs-example';
import { SURFACE_THEMES } from './surface-themes';
import { mockImageUploadInterceptor } from './image-upload-mock';
import { mockPagedQueryInterceptor } from './paged-query-mock';
import { mockQueryDemoInterceptor } from './query-demo-mock';
import { mockUploadInterceptor } from './upload-mock';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter([], withHashLocation()),
    provideAppInitializer(() => injectDocsExample().load()),
    provideHttpClient(
      withInterceptors([
        mockUploadInterceptor,
        mockImageUploadInterceptor,
        mockPagedQueryInterceptor,
        mockQueryDemoInterceptor,
      ]),
    ),
    ...provideColorThemesWithTailwind4(THEMES),
    ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
    provideColorScheme(),
    ...provideOverlay(),
    ...provideCdkOverlay(),
    provideValidatorErrorsService(),
    provideQueryDevtools(),
  ],
};
