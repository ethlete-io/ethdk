import { NgComponentOutlet, NgFor } from '@angular/common';
import { ChangeDetectionStrategy, Component, TrackByFunction, ViewEncapsulation, inject } from '@angular/core';
import { FILTER_OVERLAY_REF } from '../../constants';
import { FilterOverlayPageWithLogic } from '../../types';

@Component({
  selector: 'et-filter-overlay-page-outlet',
  template: `
    <div
      *ngFor="let page of filterOverlayRef._pages(); trackBy: trackByRoute"
      [attr.inert]="!page.isActive() || null"
      [attr.aria-hidden]="!page.isActive() || null"
      [attr.tabindex]="page.isActive() ? null : -1"
      [class.et-filter-overlay-page-outlet-page--active]="page.isActive()"
      class="et-filter-overlay-page-outlet-page"
    >
      <ng-container *ngComponentOutlet="page.component; inputs: page.inputs" />
    </div>
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
      }

      .et-filter-overlay-page-outlet-page {
        grid-area: 1 / 1 / 2 / 2;
        opacity: 0;

        transition: opacity 0.3s ease-in-out;

        &--active {
          opacity: 1;
        }
      }
    `,
  ],
  imports: [NgFor, NgComponentOutlet],
  hostDirectives: [],
})
export class FilterOverlayPageOutletComponent {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  protected readonly trackByRoute: TrackByFunction<FilterOverlayPageWithLogic> = (_, page) => page.route;
}
