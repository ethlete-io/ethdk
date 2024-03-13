import { FilterOverlayPageOutletComponent } from './components/filter-overlay-page-outlet';
import { FilterOverlayBackOrCloseDirective } from './directives/filter-overlay-back-or-close';
import { FilterOverlayLinkDirective } from './directives/filter-overlay-link';
import { FilterOverlayResetDirective } from './directives/filter-overlay-reset';
import { FilterOverlaySubmitDirective } from './directives/filter-overlay-submit';
import { FilterOverlayService } from './services';

export const FilterOverlayImports = [
  FilterOverlayPageOutletComponent,
  FilterOverlayLinkDirective,
  FilterOverlayResetDirective,
  FilterOverlaySubmitDirective,
  FilterOverlayBackOrCloseDirective,
] as const;

export const provideFilterOverlay = () => {
  return [FilterOverlayService];
};
