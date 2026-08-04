import { TOGGLETIP_CONFIG } from '../constants';
import { ToggletipConfig } from '../types';
import { createToggletipConfig } from './toggletip-config';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideToggletipConfig = (config: Partial<ToggletipConfig> | null | undefined = {}) => {
  return { provide: TOGGLETIP_CONFIG, useValue: createToggletipConfig(config) };
};
