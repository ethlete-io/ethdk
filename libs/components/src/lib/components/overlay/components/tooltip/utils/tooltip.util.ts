import { TOOLTIP_CONFIG } from '../constants';
import { TooltipConfig } from '../types';
import { createTooltipConfig } from './tooltip-config';

export const provideTooltipConfig = (config: Partial<TooltipConfig> | null | undefined = {}) => {
  return { provide: TOOLTIP_CONFIG, useValue: createTooltipConfig(config) };
};
