import { BRACKET_CONFIG_TOKEN, BRACKET_DEFAULT_CONFIG } from '../constants';
import { BracketConfig } from '../types';

export const createBracketConfig = (
  globalConfig: Partial<BracketConfig> | null | undefined = {},
  localConfig: Partial<BracketConfig> | null | undefined = {},
): BracketConfig => ({
  ...(globalConfig || {}),
  ...(localConfig || {}),
  ...BRACKET_DEFAULT_CONFIG,
});

export const provideBracketConfig = (config: Partial<BracketConfig> | null | undefined = {}) => {
  return {
    provide: BRACKET_CONFIG_TOKEN,
    useValue: createBracketConfig(config),
  };
};
