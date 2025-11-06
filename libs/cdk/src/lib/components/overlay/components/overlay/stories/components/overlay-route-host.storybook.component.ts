import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'et-sb-overlay-host-route',
  template: ` <router-outlet /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-sb-overlay-host-route',
  },
  imports: [RouterOutlet],
})
export class StorybookOverlayHostRouteComponent {}
