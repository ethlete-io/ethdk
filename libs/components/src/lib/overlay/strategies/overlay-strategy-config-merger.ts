import { RuntimeError } from '@ethlete/core';
import { OVERLAY_ERROR_CODES } from '../overlay-errors';
import { OverlayBreakpointConfig } from './overlay-strategy.types';

export const OVERLAY_CONFIG_CLASS_KEYS = /* @__PURE__ */ new Set([
  'containerClass',
  'hostClass',
  'backdropClass',
  'documentClass',
  'bodyClass',
]);

export const mergeOverlayBreakpointConfigs = (...configs: OverlayBreakpointConfig[]): OverlayBreakpointConfig => {
  const combinedConfig: OverlayBreakpointConfig = {};

  for (const config of configs) {
    for (const key in config) {
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue;

      const typedKey = key as keyof OverlayBreakpointConfig;
      const newValue = config[typedKey];

      if (newValue === undefined) continue;

      if (OVERLAY_CONFIG_CLASS_KEYS.has(key)) {
        const existing = combinedConfig[typedKey];

        const newArray = Array.isArray(newValue) ? newValue : [newValue as string];
        const existingArray = existing ? (Array.isArray(existing) ? existing : [existing as string]) : [];

        const merged = [...existingArray, ...newArray];

        const layoutClassCount = merged.filter((value) => value.startsWith('et-overlay--')).length;
        if (layoutClassCount > 1) {
          throw new RuntimeError(
            OVERLAY_ERROR_CODES.MULTIPLE_LAYOUT_CLASSES,
            `Multiple layout classes are not allowed in config key "${typedKey}". Overwrite the layout class instead of combining strategies that each provide one.`,
          );
        }

        (combinedConfig[typedKey] as unknown) = merged;
      } else {
        (combinedConfig[typedKey] as unknown) = newValue;
      }
    }
  }

  return combinedConfig;
};
