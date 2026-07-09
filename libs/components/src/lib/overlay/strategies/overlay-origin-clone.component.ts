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
  },
})
export class OverlayOriginCloneComponent {
  public animatedLifecycle = inject(AnimatedLifecycleDirective);
}
