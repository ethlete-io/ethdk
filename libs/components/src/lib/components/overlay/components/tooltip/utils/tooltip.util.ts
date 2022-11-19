import { TOOLTIP_CONFIG } from '../constants';
import { TooltipConfig } from '../types';
import { createTooltipConfig } from './tooltip-config';

export const provideTooltipConfig = (tooltipConfig: Partial<TooltipConfig> | null | undefined = {}) => {
  return { provide: TOOLTIP_CONFIG, useValue: createTooltipConfig(tooltipConfig) };
};
