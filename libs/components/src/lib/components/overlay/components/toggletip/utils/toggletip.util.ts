import { TOGGLETIP_CONFIG } from '../constants';
import { ToggletipConfig } from './toggletip-config';

export const provideToggletipConfig = (toggletipConfig: ToggletipConfig) => {
  return { provide: TOGGLETIP_CONFIG, useValue: toggletipConfig };
};
