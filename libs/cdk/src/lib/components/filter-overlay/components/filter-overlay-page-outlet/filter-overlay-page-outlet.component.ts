import { NgComponentOutlet, NgFor } from '@angular/common';
import { ChangeDetectionStrategy, Component, TrackByFunction, ViewEncapsulation, inject } from '@angular/core';
import { AnimatedIfDirective, AnimatedLifecycleDirective } from '@ethlete/core';
import { FILTER_OVERLAY_REF } from '../../constants';
import { FilterOverlayPageWithLogic } from '../../types';

@Component({
  selector: 'et-filter-overlay-page-outlet',
  template: `
    <ng-container *ngFor="let page of filterOverlayRef.pages(); trackBy: trackByRoute">
      <div class="et-filter-overlay-page-outlet-page" etAnimatedLifecycle>
        <ng-container *etAnimatedIf="page.isActive()">
          <ng-container *ngComponentOutlet="page.component; inputs: page.inputs" />
        </ng-container>
      </div>
    </ng-container>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-filter-overlay-page-outlet',
  },
  styles: [
    `
      .et-filter-overlay-page-outlet {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        overflow-x: hidden;
      }

      .et-filter-overlay-page-outlet-page {
        grid-area: 1 / 1 / 2 / 2;
        pointer-events: none;

        > * {
          pointer-events: auto;
        }

        &.et-animation-enter-from {
          transform: translateX(100%);
          opacity: 0;
        }

        &.et-animation-leave-to {
          transform: translateX(-100%);
          opacity: 0;
        }

        &.et-animation-enter-active {
          transition:
            transform 300ms var(--ease-1),
            opacity 300ms var(--ease-1);
        }

        &.et-animation-leave-active {
          transition:
            transform 600ms var(--ease-1),
            opacity 600ms var(--ease-1);
        }
      }
    `,
  ],
  imports: [NgFor, NgComponentOutlet, AnimatedIfDirective, AnimatedLifecycleDirective],
  hostDirectives: [],
})
export class FilterOverlayPageOutletComponent {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  protected readonly trackByRoute: TrackByFunction<FilterOverlayPageWithLogic> = (_, page) => page.route;
}
