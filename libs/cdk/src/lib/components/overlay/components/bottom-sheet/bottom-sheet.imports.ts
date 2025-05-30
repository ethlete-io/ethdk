import { Dialog } from '@angular/cdk/dialog';
import { BottomSheetContainerComponent } from './components/bottom-sheet-container';
import { BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER } from './constants';
import { BottomSheetDragHandleComponent } from './partials/bottom-sheet-drag-handle';
import { BottomSheetTitleDirective } from './partials/bottom-sheet-title';
import { BottomSheetService } from './services';

/**
 * @deprecated Will be removed in v5.
 */
export const BottomSheetImports = [
  BottomSheetContainerComponent,
  BottomSheetTitleDirective,
  BottomSheetDragHandleComponent,
] as const;

/**
 * @deprecated Will be removed in v5.
 */
export const provideBottomSheet = () => {
  return [BottomSheetService, BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER, Dialog];
};
