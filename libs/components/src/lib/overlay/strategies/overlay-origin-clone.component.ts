import { Component, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedLifecycleDirective } from '@ethlete/core';

@Component({
  selector: 'et-overlay-origin-clone',
  template: '<ng-content />',
  styleUrl: './overlay-origin-clone.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [AnimatedLifecycleDirective],
  host: {
    class: 'et-overlay-origin-clone',
    inert: 'true',
    // Forces a component ID distinct from the identical @ethlete/cdk twin (NG0912).
    'data-et-components': '',
  },
})
export class OverlayOriginCloneComponent {
  public animatedLifecycle = inject(AnimatedLifecycleDirective);
}
