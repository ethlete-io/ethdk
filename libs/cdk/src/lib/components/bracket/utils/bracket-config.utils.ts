import { BRACKET_CONFIG_TOKEN, BRACKET_DEFAULT_CONFIG } from '../constants';
import { BracketConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const createBracketConfig = (
  globalConfig: Partial<BracketConfig> | null | undefined = {},
  localConfig: Partial<BracketConfig> | null | undefined = {},
): BracketConfig => ({
  ...BRACKET_DEFAULT_CONFIG,
  ...(globalConfig || {}),
  ...(localConfig || {}),
});

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideBracketConfig = (config: Partial<BracketConfig> | null | undefined = {}) => {
  return {
    provide: BRACKET_CONFIG_TOKEN,
    useValue: createBracketConfig(config),
  };
};
