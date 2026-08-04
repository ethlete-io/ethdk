import { InjectionToken } from '@angular/core';
import { BracketComponent } from '../components/bracket';
import { BracketMatchComponent } from '../partials/bracket-match';
import { BracketRoundHeaderComponent } from '../partials/bracket-round-header';
import { BracketConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BRACKET_TOKEN = new InjectionToken<BracketComponent>('BRACKET_TOKEN');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BRACKET_CONFIG_TOKEN = new InjectionToken<BracketConfig>('BRACKET_CONFIG_TOKEN');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BRACKET_ROUND_ID_TOKEN = new InjectionToken<string>('BRACKET_ROUND_ID_TOKEN');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BRACKET_MATCH_ID_TOKEN = new InjectionToken<string>('BRACKET_MATCH_ID_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BRACKET_DEFAULT_CONFIG: BracketConfig = {
  roundHeaderComponent: BracketRoundHeaderComponent,
  matchComponent: BracketMatchComponent,
} as const;
