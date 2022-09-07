import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
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
  ],
});
