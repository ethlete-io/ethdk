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
      --_et-overlay-router-transition-easing: var(--ease-in-out-4);

      &.et-overlay-router-outlet-transition--none {
        .et-overlay-router-outlet-page {
          &.et-animation-enter-from,
          &.et-animation-leave-to {
            opacity: 0;
          }

          &.et-animation-enter-active,
          &.et-animation-leave-active {
            transition: opacity 0ms linear;
          }
        }
      }

      &.et-overlay-router-outlet-transition--fade {
        .et-overlay-router-outlet-page {
          &.et-animation-enter-from {
            opacity: 0;
          }

          &.et-animation-leave-to {
            opacity: 0;
          }

          &.et-animation-enter-active,
          &.et-animation-leave-active {
            transition: opacity 100ms linear;
          }
        }
      }

      &.et-overlay-router-outlet-transition--slide {
        --_et-overlay-router-transform-from: translateX(100%);
        --_et-overlay-router-transform-to: translateX(-100%);

        &.et-overlay-router-outlet-nav-dir--backward {
          --_et-overlay-router-transform-from: translateX(-100%);
          --_et-overlay-router-transform-to: translateX(100%);
        }

        .et-overlay-router-outlet-page {
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
      }

      &.et-overlay-router-outlet-transition--overlay {
        --_et-overlay-router-transform-from: translateX(100%);
        --_et-overlay-router-transform-to: translateX(-20%);
        --_et-overlay-router-out-page-brightness: 0.8;

        &.et-overlay-router-outlet-nav-dir--backward {
          --_et-overlay-router-transform-from: translateX(-20%);
          --_et-overlay-router-transform-to: translateX(100%);

          .et-overlay-router-outlet-page {
            &.et-animation-enter-from {
              filter: brightness(var(--_et-overlay-router-out-page-brightness));
            }
            &.et-animation-leave-to {
              filter: brightness(1);
            }
            &.et-animation-enter-active {
              z-index: 0;
            }

            &.et-animation-leave-active {
              z-index: 1;
            }
          }
        }

        .et-overlay-router-outlet-page {
          &.et-animation-enter-from {
            transform: var(--_et-overlay-router-transform-from);
          }

          &.et-animation-leave-to {
            filter: brightness(var(--_et-overlay-router-out-page-brightness));
            transform: var(--_et-overlay-router-transform-to);
          }

          &.et-animation-enter-active {
            z-index: 1;
          }

          &.et-animation-enter-active,
          &.et-animation-leave-active {
            transition:
              transform 225ms var(--_et-overlay-router-transition-easing),
              filter 225ms var(--_et-overlay-router-transition-easing);
          }
        }
      }

      &.et-overlay-router-outlet-transition--vertical {
        --_et-overlay-router-transform-from: translateY(20%);
        --_et-overlay-router-transform-to: translateY(-20%);
        --_et-overlay-router-out-page-brightness: 0.8;

        &.et-overlay-router-outlet-nav-dir--backward {
          --_et-overlay-router-transform-from: translateY(-20%);
          --_et-overlay-router-transform-to: translateY(20%);

          .et-overlay-router-outlet-page {
            &.et-animation-enter-from {
              filter: brightness(var(--_et-overlay-router-out-page-brightness));
            }
            &.et-animation-leave-to {
              filter: brightness(1);
            }
            &.et-animation-enter-active {
              z-index: 0;
            }

            &.et-animation-leave-active {
              z-index: 1;
            }
          }
        }

        .et-overlay-router-outlet-page {
          &.et-animation-enter-from {
            transform: var(--_et-overlay-router-transform-from);
            opacity: 0;
          }

          &.et-animation-leave-to {
            filter: brightness(var(--_et-overlay-router-out-page-brightness));
            transform: var(--_et-overlay-router-transform-to);
            opacity: 0;
          }

          &.et-animation-enter-active {
            z-index: 1;
          }

          &.et-animation-enter-active,
          &.et-animation-leave-active {
            transition:
              transform 225ms var(--_et-overlay-router-transition-easing),
              filter 225ms var(--_et-overlay-router-transition-easing),
              opacity 225ms var(--_et-overlay-router-transition-easing);
          }
        }
      }
    }

    .et-overlay-router-outlet {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      overflow: hidden;
    }

    .et-overlay-router-outlet-page {
      grid-area: 1 / 1 / 2 / 2;
      pointer-events: none;

      > * {
        pointer-events: auto;
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
    'et-overlay-router-outlet-transition--slide': computed(() => this.router.transitionType() === 'slide'),
    'et-overlay-router-outlet-transition--fade': computed(() => this.router.transitionType() === 'fade'),
    'et-overlay-router-outlet-transition--overlay': computed(() => this.router.transitionType() === 'overlay'),
    'et-overlay-router-outlet-transition--vertical': computed(() => this.router.transitionType() === 'vertical'),
    'et-overlay-router-outlet-transition--none': computed(() => this.router.transitionType() === 'none'),
  });
}
