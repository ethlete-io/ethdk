import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideOverlay as provideCdkOverlay, provideValidatorErrorsService } from '@ethlete/cdk';
import { provideOverlay } from '@ethlete/components';
import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from './color-themes';
import { injectDocsExample } from './docs-example';
import { SURFACE_THEMES } from './surface-themes';
import { mockImageUploadInterceptor } from './image-upload-mock';
import { mockPagedQueryInterceptor } from './paged-query-mock';
import { mockUploadInterceptor } from './upload-mock';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter([], withHashLocation()),
    provideAppInitializer(() => injectDocsExample().load()),
    provideHttpClient(withInterceptors([mockUploadInterceptor, mockImageUploadInterceptor, mockPagedQueryInterceptor])),
    ...provideColorThemesWithTailwind4(THEMES),
    ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
    ...provideOverlay(),
    ...provideCdkOverlay(),
    provideValidatorErrorsService(),
  ],
};
