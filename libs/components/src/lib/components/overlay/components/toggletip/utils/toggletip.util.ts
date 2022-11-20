import { TOGGLETIP_CONFIG } from '../constants';
import { ToggletipConfig } from '../types';
import { createToggletipConfig } from './toggletip-config';

export const provideToggletipConfig = (config: Partial<ToggletipConfig> | null | undefined = {}) => {
  return { provide: TOGGLETIP_CONFIG, useValue: createToggletipConfig(config) };
};
