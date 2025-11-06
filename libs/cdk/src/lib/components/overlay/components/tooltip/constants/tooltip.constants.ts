import { InjectionToken, TemplateRef } from '@angular/core';
import { TooltipConfig } from '../types';

export const TOOLTIP_CONFIG = new InjectionToken<TooltipConfig>('TooltipConfig');

export const TOOLTIP_TEXT = new InjectionToken<string | null>('TooltipText');

export const TOOLTIP_TEMPLATE = new InjectionToken<TemplateRef<unknown> | null>('TooltipTemplate');

export const TOOLTIP_DEFAULT_CONFIG: TooltipConfig = {
  placement: 'bottom',
  offset: 8,
  arrowPadding: 8,
  viewportPadding: 8,
  customAnimated: false,
} as const;
