import { Dialog, DIALOG_SCROLL_STRATEGY_PROVIDER } from '@angular/cdk/dialog';
import { BottomSheetContainerComponent } from './components';
import { BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER } from './constants';
import { BottomSheetDragHandleComponent, BottomSheetTitleDirective } from './partials';
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
  return [BottomSheetService, BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER, Dialog, DIALOG_SCROLL_STRATEGY_PROVIDER];
};
