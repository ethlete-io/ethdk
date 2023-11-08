import { Breakpoint } from '@ethlete/core';
import { BottomSheetConfig, BottomSheetRef, DialogConfig, DialogRef } from '../components';

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
