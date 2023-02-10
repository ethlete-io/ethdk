import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideBottomSheet, provideDialog, provideSort, provideValidatorErrorsService } from '@ethlete/components';
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
    provideDialog(),
    provideBottomSheet(),
    provideSort(),
    provideRouter([], withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    provideValidatorErrorsService(),
  ],
});
