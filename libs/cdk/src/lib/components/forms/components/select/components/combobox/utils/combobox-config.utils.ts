import { COMBOBOX_CONFIG_TOKEN, COMBOBOX_DEFAULT_CONFIG } from '../constants';
import { ComboboxConfig } from '../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const createComboboxConfig = (
  globalConfig: Partial<ComboboxConfig> | null | undefined = {},
  localConfig: Partial<ComboboxConfig> | null | undefined = {},
): ComboboxConfig => ({
  ...COMBOBOX_DEFAULT_CONFIG,
  ...(globalConfig || {}),
  ...(localConfig || {}),
});

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideComboboxConfig = (config: Partial<ComboboxConfig> | null | undefined = {}) => {
  return {
    provide: COMBOBOX_CONFIG_TOKEN,
    useValue: createComboboxConfig(config),
  };
};
