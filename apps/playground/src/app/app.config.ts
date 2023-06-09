import { ApplicationConfig } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideThemes } from '@ethlete/theming';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
    provideThemes([
      {
        name: 'default',
        isDefault: true,
        color: {
          default: '#00ffa1',
          hover: '#00ee99',
          active: '#00dd88',
          disabled: '#00cc77',
        },
        onColor: {
          default: '#000000',
          hover: '#000000',
          active: '#000000',
          disabled: '#000000',
        },
      },
    ]),
  ],
};
