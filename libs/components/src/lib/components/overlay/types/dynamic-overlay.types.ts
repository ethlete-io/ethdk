import { Breakpoint } from '@ethlete/core';
import { BottomSheetConfig, BottomSheetRef, DialogConfig, DialogRef } from '../components';

export interface DynamicOverlayConfig<D> {
  isDialogFrom: Breakpoint;
  bottomSheetConfig: BottomSheetConfig<D>;
  dialogConfig: DialogConfig<D>;
}

export type DynamicOverlayRed<T, R> = BottomSheetRef<T, R> | DialogRef<T, R>;
