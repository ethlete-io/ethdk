import { BRACKET_CONFIG_TOKEN } from '../constants';
import { BracketMatchBodyComponent, BracketMatchHeaderComponent, BracketRoundHeaderComponent } from '../partials';
import { BracketConfig, RequiredBracketConfig } from '../types';

export const mergeBracketConfig = (config: BracketConfig | null | undefined): RequiredBracketConfig => {
  const value: RequiredBracketConfig = {
    roundHeader: {
      component:
        config?.roundHeader?.component || config?.roundHeader?.component === null
          ? config?.roundHeader?.component
          : BracketRoundHeaderComponent,
    },
    match: {
      headerComponent:
        config?.match?.headerComponent || config?.match?.headerComponent === null
          ? config?.match?.headerComponent
          : BracketMatchHeaderComponent,
      bodyComponent:
        config?.match?.bodyComponent || config?.match?.bodyComponent === null
          ? config?.match?.bodyComponent
          : BracketMatchBodyComponent,
      footerComponent: config?.match?.footerComponent || null,
    },
  };

  return value;
};

export const provideBracketConfig = (config: BracketConfig) => {
  return {
    provide: BRACKET_CONFIG_TOKEN,
    useValue: mergeBracketConfig(config),
  };
};
