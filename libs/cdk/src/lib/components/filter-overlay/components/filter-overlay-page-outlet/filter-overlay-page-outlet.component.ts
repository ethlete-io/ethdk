import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-filter-overlay-page-outlet',
  template: ``,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-filter-overlay-page-outlet',
  },
  imports: [],
  hostDirectives: [],
})
export class FilterOverlayPageOutletComponent {}
