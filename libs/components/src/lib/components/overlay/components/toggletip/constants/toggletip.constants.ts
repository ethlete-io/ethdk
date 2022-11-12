import { InjectionToken } from '@angular/core';
import { ToggletipConfig } from '../utils';

export const TOGGLETIP_TRANSITION_DURATION_PROPERTY = '--et-toggletip-transition-duration';

export const TOGGLETIP_ANIMATION_CLASSES = {
  opening: 'et-toggletip--opening',
  open: 'et-toggletip--open',
  closing: 'et-toggletip--closing',
  closed: 'et-toggletip--closed',
};

export const TOGGLETIP_CONFIG = new InjectionToken<ToggletipConfig>('ToggletipConfig');
