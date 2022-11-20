import { BOTTOM_SHEET_DEFAULT_CONFIG } from '../constants';
import { BottomSheetConfigType } from '../types';

export const createBottomSheetConfig = <D = unknown>(
  config?: Partial<BottomSheetConfigType<D>> | null | undefined,
): BottomSheetConfigType<D> => ({
  ...(BOTTOM_SHEET_DEFAULT_CONFIG as BottomSheetConfigType<D>),
  ...(config || {}),
});
