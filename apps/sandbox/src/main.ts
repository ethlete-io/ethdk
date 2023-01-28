import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withRouterConfig } from '@angular/router';
import { BottomSheetDefaultProviders, DialogDefaultProviders, SortDefaultProviders } from '@ethlete/components';
import { provideThemeConfig } from '@ethlete/theming';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideThemeConfig({
      themes: ['primary', 'accent', 'warning'],
      defaultTheme: 'accent',
    }),
    provideAnimations(),
    DialogDefaultProviders,
    BottomSheetDefaultProviders,
    SortDefaultProviders,
    provideRouter([], withRouterConfig({ paramsInheritanceStrategy: 'always' })),
  ],
});
