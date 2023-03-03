import { InjectionToken, TemplateRef } from '@angular/core';
import { ToggletipConfig } from '../types';

export const TOGGLETIP_CONFIG = new InjectionToken<ToggletipConfig>('ToggletipConfig');
export const TOGGLETIP_TEXT = new InjectionToken<string | null>('ToggletipText');
export const TOGGLETIP_TEMPLATE = new InjectionToken<TemplateRef<unknown> | null>('ToggletipTemplate');

export const TOGGLETIP_DEFAULT_CONFIG: ToggletipConfig = {
  placement: 'auto',
  offset: [0, 8],
  arrowPadding: 4,
  customAnimated: false,
} as const;
