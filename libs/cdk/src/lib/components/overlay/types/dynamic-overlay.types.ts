import { Breakpoint } from '@ethlete/core';
import { BottomSheetConfig } from '../components/bottom-sheet/types';
import { BottomSheetRef } from '../components/bottom-sheet/utils';
import { DialogConfig } from '../components/dialog/types';
import { DialogRef } from '../components/dialog/utils';

/**
 * @deprecated Will be removed in v5.
 */
export interface DynamicOverlayConfig<D> {
  isDialogFrom: Breakpoint;
  bottomSheetConfig?: BottomSheetConfig<D>;
  dialogConfig?: DialogConfig<D>;
}

/**
 * @deprecated Will be removed in v5.
 */
export type DynamicOverlayRed<T, R> = BottomSheetRef<T, R> | DialogRef<T, R>;
