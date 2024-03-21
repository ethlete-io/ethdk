import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { AnimatedIfDirective, AnimatedLifecycleDirective, signalHostClasses } from '@ethlete/core';
import { OverlayRouterService } from '../../utils';

@Component({
  selector: 'et-overlay-router-outlet',
  template: `
    <div class="et-overlay-router-outlet">
      @for (page of router.routes(); track page.path) {
        <div class="et-overlay-router-outlet-page" etAnimatedLifecycle>
          <ng-container *etAnimatedIf="page === router.currentPage()">
            <ng-container *ngComponentOutlet="page.component; inputs: page.inputs" />
          </ng-container>
        </div>
      }
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-router-outlet-host',
  },
  styles: `
    .et-overlay-router-outlet-host {
      --_et-overlay-router-transform-from: translateX(100%);
      --_et-overlay-router-transform-to: translateX(-100%);
      --_et-overlay-router-transition-easing: var(--ease-in-out-5);

      &.et-overlay-router-outlet-nav-dir--backward {
        --_et-overlay-router-transform-from: translateX(-100%);
        --_et-overlay-router-transform-to: translateX(100%);
      }
    }

    .et-overlay-router-outlet {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      overflow-x: hidden;
    }

    .et-overlay-router-outlet-page {
      grid-area: 1 / 1 / 2 / 2;
      pointer-events: none;

      > * {
        pointer-events: auto;
      }

      &.et-animation-enter-from {
        transform: var(--_et-overlay-router-transform-from);
        opacity: 0;
      }

      &.et-animation-leave-to {
        transform: var(--_et-overlay-router-transform-to);
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
  imports: [AnimatedIfDirective, AnimatedLifecycleDirective, NgComponentOutlet],
})
export class OverlayRouterOutletComponent {
  router = inject(OverlayRouterService);

  hostClassBindings = signalHostClasses({
    'et-overlay-router-outlet-nav-dir--backward': computed(() => this.router.navigationDirection() === 'backward'),
    'et-overlay-router-outlet-nav-dir--forward': computed(() => this.router.navigationDirection() === 'forward'),
  });
}
