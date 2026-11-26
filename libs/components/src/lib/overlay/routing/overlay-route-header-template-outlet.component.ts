import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedIfDirective, AnimatedLifecycleDirective } from '@ethlete/core';
import { OVERLAY_REF } from '../overlay-ref';
import { injectOverlayRouter } from './overlay-router';

@Component({
  selector: 'et-overlay-route-header-template-outlet',
  template: `
    <div class="et-overlay-route-header-template-outlet">
      <!-- eslint-disable-next-line ethlete/prefer-static-boolean-properties -- skipNextEnter is a two-way model() on the core AnimatedLifecycle directive; no booleanAttribute transform applies -->
      <div [skipNextEnter]="true" class="et-overlay-route-header-template-outlet-item" etAnimatedLifecycle>
        <ng-container *etAnimatedIf="overlay.headerTemplate()">
          <ng-container *ngTemplateOutlet="overlay.headerTemplate()" />
        </ng-container>
      </div>
    </div>
  `,
  styleUrl: './overlay-route-header-template-outlet.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatedIfDirective, AnimatedLifecycleDirective, NgTemplateOutlet],
  host: {
    class: 'et-overlay-route-header-template-outlet-host',
    '[class.et-overlay-router-outlet-nav-dir--backward]': "router.navigationDirection() === 'backward'",
    '[class.et-overlay-router-outlet-nav-dir--forward]': "router.navigationDirection() === 'forward'",
  },
})
export class OverlayRouteHeaderTemplateOutletComponent {
  protected overlay = inject(OVERLAY_REF);
  protected router = injectOverlayRouter();
  public animatedLifecycle = viewChild.required(ANIMATED_LIFECYCLE_TOKEN);
}
