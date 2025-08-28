import { injectQueryParam } from './signal.utils';

export const DISABLE_LOGGER_PARAM = 'et-logger-quiet';

export type CreateLoggerConfig = {
  scope: string;
  feature: string;
};

export const createLogger = (config: CreateLoggerConfig) => {
  const { scope, feature } = config;
  const disableLogging = injectQueryParam(DISABLE_LOGGER_PARAM);

  const writeLog = (...args: unknown[]) => {
    if (disableLogging()) {
      return;
    }
    console.log(...args);
  };

  return {
    log: (...args: unknown[]) => writeLog(`\x1B[32;40;24m[${scope} ${feature}]\x1B[m`, ...args),
    warn: (...args: unknown[]) => writeLog(`\x1B[93;40;24m[${scope} ${feature}]\x1B[m`, ...args),
    error: (...args: unknown[]) => writeLog(`\x1B[31;40;24m[${scope} ${feature}]\x1B[m`, ...args),
  };
};
