import { InjectionToken, TemplateRef } from '@angular/core';
import { ToggletipConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOGGLETIP_CONFIG = new InjectionToken<ToggletipConfig>('ToggletipConfig');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOGGLETIP_TEXT = new InjectionToken<string | null>('ToggletipText');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOGGLETIP_TEMPLATE = new InjectionToken<TemplateRef<unknown> | null>('ToggletipTemplate');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOGGLETIP_DEFAULT_CONFIG: ToggletipConfig = {
  placement: 'bottom',
  offset: 8,
  arrowPadding: 8,
  viewportPadding: 8,
  customAnimated: false,
} as const;
