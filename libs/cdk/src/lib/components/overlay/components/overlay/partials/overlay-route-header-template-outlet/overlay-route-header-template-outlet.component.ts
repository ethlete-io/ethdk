import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, viewChild } from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedIfDirective,
  AnimatedLifecycleDirective,
  signalHostClasses,
} from '@ethlete/core';
import { OverlayRef, OverlayRouterService } from '../../utils';

@Component({
  selector: 'et-overlay-route-header-template-outlet',
  template: `
    <div class="et-overlay-route-header-template-outlet">
      <div [skipNextEnter]="true" class="et-overlay-route-header-template-outlet-item" etAnimatedLifecycle>
        <ng-container *etAnimatedIf="overlay.headerTemplate()">
          <ng-container *ngTemplateOutlet="overlay.headerTemplate()" />
        </ng-container>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-route-header-template-outlet-host',
  },
  styles: `
    .et-overlay-route-header-template-outlet-host {
      --_et-overlay-router-transition-easing: var(--ease-in-out-5);
    }

    .et-overlay-route-header-template-outlet {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      overflow-x: hidden;
    }

    .et-overlay-route-header-template-outlet-item {
      grid-area: 1 / 1 / 2 / 2;
      pointer-events: none;

      > * {
        pointer-events: auto;
      }

      &.et-animation-enter-from {
        opacity: 0;
      }

      &.et-animation-leave-to {
        opacity: 0;
      }

      &.et-animation-enter-active,
      &.et-animation-leave-active {
        transition:
          transform 300ms var(--_et-overlay-router-transition-easing),
          opacity 300ms var(--_et-overlay-router-transition-easing);
      }
    }
  `,
  imports: [AnimatedIfDirective, AnimatedLifecycleDirective, NgTemplateOutlet],
})
export class OverlayRouteHeaderTemplateOutletComponent {
  router = inject(OverlayRouterService);
  overlay = inject(OverlayRef);
  animatedLifecycle = viewChild.required(ANIMATED_LIFECYCLE_TOKEN);

  hostClassBindings = signalHostClasses({
    'et-overlay-router-outlet-nav-dir--backward': computed(() => this.router.navigationDirection() === 'backward'),
    'et-overlay-router-outlet-nav-dir--forward': computed(() => this.router.navigationDirection() === 'forward'),
  });
}
