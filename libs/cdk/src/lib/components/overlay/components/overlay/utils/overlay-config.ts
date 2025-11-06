import { OVERLAY_DEFAULT_CONFIG } from '../constants';
import { OverlayConfig } from '../types';

export const createOverlayConfig = <D = unknown>(
  globalConfig?: Partial<OverlayConfig<D>> | null | undefined,
  localConfig?: Partial<OverlayConfig<D>> | null | undefined,
): OverlayConfig<D> => ({
  ...(OVERLAY_DEFAULT_CONFIG as OverlayConfig<D>),
  ...(globalConfig || {}),
  ...(localConfig || {}),
});
