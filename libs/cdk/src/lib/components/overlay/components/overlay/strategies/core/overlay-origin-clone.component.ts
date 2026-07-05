import { Component, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedLifecycleDirective } from '@ethlete/core';

@Component({
  selector: 'et-overlay-origin-clone',
  standalone: true,
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [AnimatedLifecycleDirective],
  host: {
    class: 'et-overlay-origin-clone',
    inert: 'true',
  },
  styleUrl: './overlay-origin-clone.component.scss',
})
export class OverlayOriginCloneComponent {
  animatedLifecycle = inject(AnimatedLifecycleDirective);
}
