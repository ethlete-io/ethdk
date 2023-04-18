import { TOOLTIP_DEFAULT_CONFIG } from '../constants';
import { TooltipConfig } from '../types';

export const createTooltipConfig = (config: Partial<TooltipConfig> | null | undefined = {}): TooltipConfig => ({
  ...TOOLTIP_DEFAULT_CONFIG,
  ...(config || {}),
});
