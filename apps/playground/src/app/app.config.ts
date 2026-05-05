import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideColorThemes, provideTitleConfig } from '@ethlete/core';
import { provideQueryClientForDevtools } from '@ethlete/query';
import { appRoutes } from './app.routes';
import { client } from './query/entity/queries';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
    provideHttpClient(withFetch()),
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideColorThemes([
      {
        name: 'default',
        isDefault: true,
        primary: {
          color: {
            default: '0 255 161',
            hover: '76 247 184',
            focus: '76 247 184',
            active: '0 198 126',
            disabled: '0 122 77',
          },
          onColor: {
            default: '0 0 0',
            disabled: '0 36 23',
          },
        },
      },
      {
        name: 'red',
        isDefaultAlt: true,
        primary: {
          color: {
            default: '255 0 0',
            hover: '255 76 76',
            focus: '255 76 76',
            active: '198 0 0',
            disabled: '128 32 32',
          },
          onColor: {
            default: '0 0 0',
            disabled: '48 0 0',
          },
        },
      },
    ]),
    provideQueryClientForDevtools({ client: client, displayName: 'Ethlete' }),
    provideQueryClientForDevtools({ client: client }),
    provideTitleConfig({
      suffixPart: {
        text: 'Ethlete SDK',
      },
    }),
  ],
};
