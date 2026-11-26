import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { createFakePorts } from './e2e/fake-ports';
import { HOST_PORTS } from './host/ports';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [...appConfig.providers, { provide: HOST_PORTS, useFactory: createFakePorts }],
}).catch((error) => console.error(error));
