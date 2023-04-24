import { DIALOG_DEFAULT_CONFIG } from '../constants';
import { DialogConfig } from '../types';

export const createDialogConfig = <D = unknown>(
  globalConfig?: Partial<DialogConfig<D>> | null | undefined,
  localConfig?: Partial<DialogConfig<D>> | null | undefined,
): DialogConfig<D> => ({
  ...(DIALOG_DEFAULT_CONFIG as DialogConfig<D>),
  ...(globalConfig || {}),
  ...(localConfig || {}),
});
