import { InjectionToken, TemplateRef } from '@angular/core';
import { TooltipConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOOLTIP_CONFIG = new InjectionToken<TooltipConfig>('TooltipConfig');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOOLTIP_TEXT = new InjectionToken<string | null>('TooltipText');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOOLTIP_TEMPLATE = new InjectionToken<TemplateRef<unknown> | null>('TooltipTemplate');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOOLTIP_DEFAULT_CONFIG: TooltipConfig = {
  placement: 'bottom',
  offset: 8,
  arrowPadding: 8,
  viewportPadding: 8,
  customAnimated: false,
} as const;
