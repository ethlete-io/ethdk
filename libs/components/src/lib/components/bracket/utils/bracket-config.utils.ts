import { BRACKET_CONFIG_TOKEN } from '../constants';
import { BracketMatchBodyComponent, BracketRoundHeaderComponent } from '../partials';
import { BracketConfig, RequiredBracketConfig } from '../types';

export const mergeBracketConfig = (
  componentConfig: BracketConfig | null | undefined,
  globalConfig: BracketConfig | null | undefined,
): RequiredBracketConfig => {
  const value: RequiredBracketConfig = {
    roundHeader: {
      component:
        componentConfig?.roundHeader?.component || componentConfig?.roundHeader?.component === null
          ? componentConfig?.roundHeader?.component
          : globalConfig?.roundHeader?.component || globalConfig?.roundHeader?.component === null
          ? globalConfig?.roundHeader?.component
          : BracketRoundHeaderComponent,
    },
    match: {
      component: componentConfig?.match?.component
        ? componentConfig?.match?.component
        : globalConfig?.match?.component
        ? globalConfig?.match?.component
        : BracketMatchBodyComponent,
    },
  };

  return value;
};

export const provideBracketConfig = (config: BracketConfig) => {
  return {
    provide: BRACKET_CONFIG_TOKEN,
    useValue: mergeBracketConfig(config, undefined),
  };
};
