import { Component, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedLifecycleDirective } from '@ethlete/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-overlay-origin-clone',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [AnimatedLifecycleDirective],
  host: {
    class: 'et-overlay-origin-clone et-legacy',
    inert: 'true',
  },
  styleUrl: './overlay-origin-clone.component.scss',
})
export class OverlayOriginCloneComponent {
  animatedLifecycle = inject(AnimatedLifecycleDirective);
}
