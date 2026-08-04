import { TOOLTIP_CONFIG } from '../constants';
import { TooltipConfig } from '../types';
import { createTooltipConfig } from './tooltip-config';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideTooltipConfig = (config: Partial<TooltipConfig> | null | undefined = {}) => {
  return { provide: TOOLTIP_CONFIG, useValue: createTooltipConfig(config) };
};
