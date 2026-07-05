import { Component, ViewEncapsulation, inject, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overlay-origin-clone.component.scss',
})
export class OverlayOriginCloneComponent {
  animatedLifecycle = inject(AnimatedLifecycleDirective);
}
