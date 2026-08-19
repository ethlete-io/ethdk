import { injectQueryParam } from '../signals';

export const DISABLE_LOGGER_PARAM = 'et-logger-quiet';

export type CreateLoggerConfig = {
  scope: string;
  feature: string;
};

export const createLogger = (config: CreateLoggerConfig) => {
  const { scope, feature } = config;
  const disableLogging = injectQueryParam(DISABLE_LOGGER_PARAM);

  return {
    log: (...args: unknown[]) => {
      if (!disableLogging()) console.log(`\x1B[32;40;24m[${scope} ${feature}]\x1B[m`, ...args);
    },
    warn: (...args: unknown[]) => {
      if (!disableLogging()) console.warn(`\x1B[93;40;24m[${scope} ${feature}]\x1B[m`, ...args);
    },
    error: (...args: unknown[]) => {
      if (!disableLogging()) console.error(`\x1B[31;40;24m[${scope} ${feature}]\x1B[m`, ...args);
    },
  };
};
