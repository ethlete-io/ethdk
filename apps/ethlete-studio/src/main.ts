import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// eslint-disable-next-line ethlete/no-window-location -- runs before bootstrap, so no injector exists yet
if ((typeof ngDevMode === 'undefined' || ngDevMode) && location.pathname.endsWith('/__design-harness')) {
  import('./app/design-harness/design-harness.component')
    .then((m) => bootstrapApplication(m.DesignHarnessComponent, appConfig))
    .catch((error: unknown) => console.error(error));
} else {
  bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => console.error(error));
}
