import { TOOLTIP_DEFAULT_CONFIG } from '../constants';
import { TooltipConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const createTooltipConfig = (config: Partial<TooltipConfig> | null | undefined = {}): TooltipConfig => ({
  ...TOOLTIP_DEFAULT_CONFIG,
  ...(config || {}),
});
