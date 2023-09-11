import { Directive, InjectionToken, Input, inject, signal } from '@angular/core';
import { FILTER_OVERLAY_REF } from '../../constants';

export const FILTER_OVERLAY_LINK_TOKEN = new InjectionToken<FilterOverlayLinkDirective>('FILTER_OVERLAY_LINK_TOKEN');

@Directive({
  selector: '[etFilterOverlayLink]',
  standalone: true,
  providers: [
    {
      provide: FILTER_OVERLAY_LINK_TOKEN,
      useExisting: FilterOverlayLinkDirective,
    },
  ],
  host: {
    class: 'et-filter-overlay-link',
    '[class.et-filter-overlay-link--active]': 'path() === filterOverlayRef.currentRoute()',
    '(click)': 'navigate()',
  },
})
export class FilterOverlayLinkDirective {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  @Input({ required: true, alias: 'etFilterOverlayLink' })
  set _path(value: string | string[]) {
    this.path.set(this.filterOverlayRef._buildRoute(value));
  }

  readonly path = signal<string>('');

  navigate() {
    this.filterOverlayRef.navigateTo(this.path());
  }
}
