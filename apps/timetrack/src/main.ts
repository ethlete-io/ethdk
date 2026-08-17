import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { WidgetComponent } from './app/widget/widget.component';
import { widgetConfig } from './app/widget/widget.config';
import { isWidgetWindow } from './app/widget/window-label';

// One bundle, two roots, picked by the window's own label - a second entry point would be a second
// build and a second `index.html` for one small window. Both root elements stand in the document; this
// is what decides which of them a component is put into.
const [component, config] = isWidgetWindow() ? [WidgetComponent, widgetConfig] : [AppComponent, appConfig];

bootstrapApplication(component, config).catch((error) => console.error(error));
