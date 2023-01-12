import { TOGGLETIP_DEFAULT_CONFIG } from '../constants';
import { ToggletipConfig } from '../types';

export const createToggletipConfig = (config: Partial<ToggletipConfig> | null | undefined = {}): ToggletipConfig => ({
  ...TOGGLETIP_DEFAULT_CONFIG,
  ...(config || {}),
});
