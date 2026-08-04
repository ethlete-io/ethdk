import { TOGGLETIP_DEFAULT_CONFIG } from '../constants';
import { ToggletipConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const createToggletipConfig = (config: Partial<ToggletipConfig> | null | undefined = {}): ToggletipConfig => ({
  ...TOGGLETIP_DEFAULT_CONFIG,
  ...(config || {}),
});
