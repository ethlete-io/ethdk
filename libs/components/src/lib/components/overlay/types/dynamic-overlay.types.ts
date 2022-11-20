import { Breakpoint } from '@ethlete/core';
import { BottomSheetConfigType, BottomSheetRef, DialogConfig, DialogRef } from '../components';

export interface DynamicOverlayConfig<D> {
  isDialogFrom: Breakpoint;
  bottomSheetConfig?: BottomSheetConfigType<D>;
  dialogConfig?: DialogConfig<D>;
}

export type DynamicOverlayRed<T, R> = BottomSheetRef<T, R> | DialogRef<T, R>;
