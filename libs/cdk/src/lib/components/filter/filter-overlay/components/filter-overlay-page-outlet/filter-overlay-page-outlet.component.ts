import { NgComponentOutlet, NgFor } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { AnimatedIfDirective, AnimatedLifecycleDirective, signalHostClasses } from '@ethlete/core';
import { FILTER_OVERLAY_REF } from '../../constants';
import { FilterOverlayPage } from '../../types';

@Component({
  selector: 'et-filter-overlay-page-outlet',
  template: `
    <ng-container *ngFor="let page of filterOverlayRef.pages; trackBy: trackByRoute">
      <div class="et-filter-overlay-page-outlet-page" etAnimatedLifecycle>
        <ng-container *etAnimatedIf="page === filterOverlayRef.currentPage()">
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

        --_et-filter-transform-from: translateX(100%);
        --_et-filter-transform-to: translateX(-100%);

        &.et-filter-overlay-page-outlet--backward {
          --_et-filter-transform-from: translateX(-100%);
          --_et-filter-transform-to: translateX(100%);
        }
      }

      .et-filter-overlay-page-outlet-page {
        --transition-easing: var(--ease-in-out-5);

        grid-area: 1 / 1 / 2 / 2;
        pointer-events: none;

        > * {
          pointer-events: auto;
        }

        &.et-animation-enter-from {
          transform: var(--_et-filter-transform-from);
          opacity: 0;
        }

        &.et-animation-leave-to {
          transform: var(--_et-filter-transform-to);
          opacity: 0;
        }

        &.et-animation-enter-active,
        &.et-animation-leave-active {
          transition:
            transform 300ms var(--transition-easing),
            opacity 300ms var(--transition-easing);
        }
      }
    `,
  ],
  imports: [NgFor, NgComponentOutlet, AnimatedIfDirective, AnimatedLifecycleDirective],
  hostDirectives: [],
})
export class FilterOverlayPageOutletComponent {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  protected readonly trackByRoute: TrackByFunction<FilterOverlayPage> = (_, page) => page.route;

  constructor() {
    signalHostClasses({
      'et-filter-overlay-page-outlet--backward': computed(() => {
        const page = this.filterOverlayRef.currentPage();

        return page?.route === '' || page?.route === '/';
      }),
      'et-filter-overlay-page-outlet--forward': computed(() => {
        const page = this.filterOverlayRef.currentPage();

        return page?.route !== '' && page?.route !== '/';
      }),
    });
  }
}
