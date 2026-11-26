import { OverlayBreakpointConfig } from './types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const ET_OVERLAY_CONFIG_CLASS_KEYS = new Set([
  'containerClass',
  'paneClass',
  'overlayClass',
  'backdropClass',
  'documentClass',
  'bodyClass',
]);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const mergeOverlayBreakpointConfigs = (...configs: OverlayBreakpointConfig[]): OverlayBreakpointConfig => {
  const combinedConfig: OverlayBreakpointConfig = {};

  for (const config of configs) {
    for (const key in config) {
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue;

      const typedKey = key as keyof OverlayBreakpointConfig;
      const newValue = config[typedKey];

      if (newValue === undefined) continue;

      if (ET_OVERLAY_CONFIG_CLASS_KEYS.has(key)) {
        const existing = combinedConfig[typedKey];

        const newArray = Array.isArray(newValue) ? newValue : [newValue as string];
        const existingArray = existing ? (Array.isArray(existing) ? existing : [existing as string]) : [];

        const merged = [...existingArray, ...newArray];

        const layoutClassCount = merged.filter((value) => value.startsWith('et-overlay--')).length;
        if (layoutClassCount > 1) {
          throw new Error(`Multiple layout classes are not allowed in config key: ${typedKey}`);
        }

        (combinedConfig[typedKey] as any) = merged;
      } else {
        (combinedConfig[typedKey] as any) = newValue;
      }
    }
  }

  return combinedConfig;
};
