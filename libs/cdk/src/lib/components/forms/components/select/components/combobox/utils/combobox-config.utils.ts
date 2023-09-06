import { COMBOBOX_CONFIG_TOKEN, COMBOBOX_DEFAULT_CONFIG } from '../constants';
import { ComboboxConfig } from '../types';

export const createComboboxConfig = (
  globalConfig: Partial<ComboboxConfig> | null | undefined = {},
  localConfig: Partial<ComboboxConfig> | null | undefined = {},
): ComboboxConfig => ({
  ...COMBOBOX_DEFAULT_CONFIG,
  ...(globalConfig || {}),
  ...(localConfig || {}),
});

export const provideComboboxConfig = (config: Partial<ComboboxConfig> | null | undefined = {}) => {
  return {
    provide: COMBOBOX_CONFIG_TOKEN,
    useValue: createComboboxConfig(config),
  };
};
