import { BOTTOM_SHEET_DEFAULT_CONFIG } from '../constants';
import { BottomSheetConfig } from '../types';

export const createBottomSheetConfig = <D = unknown>(
  globalConfig?: Partial<BottomSheetConfig<D>> | null | undefined,
  localConfig?: Partial<BottomSheetConfig<D>> | null | undefined,
): BottomSheetConfig<D> => ({
  ...(BOTTOM_SHEET_DEFAULT_CONFIG as BottomSheetConfig<D>),
  ...(globalConfig || {}),
  ...(localConfig || {}),
});
