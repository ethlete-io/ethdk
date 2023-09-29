import { FilterOverlayPageOutletComponent } from './components';
import {
  FilterOverlayBackOrCloseDirective,
  FilterOverlayLinkDirective,
  FilterOverlayResetDirective,
  FilterOverlaySubmitDirective,
} from './directives';
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
