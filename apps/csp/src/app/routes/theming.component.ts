import { Component, ViewEncapsulation } from '@angular/core';
import {
  AutoSurfaceDirective,
  ColorInteractiveDirective,
  ProvideColorDirective,
  ProvideSurfaceDirective,
} from '@ethlete/core';

@Component({
  selector: 'app-theming',
  template: `
    <div etProvideSurface="app-raised" data-testid="surface">
      <p>Raised surface</p>
      <div etAutoSurface>
        <p>Auto surface</p>
      </div>
      <div etProvideColor="app-error">
        <button etColorInteractive type="button">Error themed</button>
      </div>
      <button type="button">Surface interactive</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideSurfaceDirective, AutoSurfaceDirective, ProvideColorDirective, ColorInteractiveDirective],
})
export class ThemingRouteComponent {}
