import { TOOLTIP_CONFIG } from '../constants';
import { TooltipConfig } from './tooltip-config';

export const provideTooltipConfig = (tooltipConfig: TooltipConfig) => {
  return { provide: TOOLTIP_CONFIG, useValue: tooltipConfig };
};
