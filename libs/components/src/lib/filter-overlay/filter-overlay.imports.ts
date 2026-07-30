import {
  FilterOverlayResetDirective,
  FilterOverlaySubmitDirective,
} from './headless/filter-overlay-controls.directive';

export const FILTER_OVERLAY_IMPORTS = [FilterOverlaySubmitDirective, FilterOverlayResetDirective] as const;
