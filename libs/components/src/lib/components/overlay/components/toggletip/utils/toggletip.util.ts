import { TOGGLETIP_CONFIG } from '../constants';
import { ToggletipConfig } from '../types';
import { createToggletipConfig } from './toggletip-config';

export const provideToggletipConfig = (toggletipConfig: Partial<ToggletipConfig> | null | undefined = {}) => {
  return { provide: TOGGLETIP_CONFIG, useValue: createToggletipConfig(toggletipConfig) };
};
