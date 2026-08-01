import { Binding, StaticProvider } from '@angular/core';
import { OverlayConfig } from './overlay-config';

const CLASS_KEYS = ['hostClass', 'backdropClass', 'panelClass'] as const;

const normalizeClassList = (value?: string | string[]) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

/**
 * Merges overlay configs from least to most specific (e.g. definition → opener → per-open).
 *
 * - `bindings` and `providers` are concatenated in layer order - a later binding or provider
 *   for the same input/token wins, matching Angular semantics.
 * - `hostClass`, `backdropClass` and `panelClass` are normalized to arrays, concatenated and deduped.
 * - Every other key is taken from the last layer that sets it to a value other than `undefined`
 *   (an explicit `null`, e.g. on the aria fields, does override earlier layers).
 */
export const mergeOverlayConfigs = (...configs: (OverlayConfig | undefined)[]): OverlayConfig => {
  const merged: OverlayConfig = {};
  const bindings: Binding[] = [];
  const providers: StaticProvider[] = [];
  const classes: Record<(typeof CLASS_KEYS)[number], string[]> = {
    hostClass: [],
    backdropClass: [],
    panelClass: [],
  };

  for (const config of configs) {
    if (!config) continue;

    const {
      bindings: layerBindings,
      providers: layerProviders,
      hostClass,
      backdropClass,
      panelClass,
      ...scalars
    } = config;

    bindings.push(...(layerBindings ?? []));
    providers.push(...(layerProviders ?? []));
    classes.hostClass.push(...normalizeClassList(hostClass));
    classes.backdropClass.push(...normalizeClassList(backdropClass));
    classes.panelClass.push(...normalizeClassList(panelClass));

    for (const [key, value] of Object.entries(scalars)) {
      if (value === undefined) continue;

      (merged as Record<string, unknown>)[key] = value;
    }
  }

  if (bindings.length) {
    merged.bindings = bindings;
  }

  if (providers.length) {
    merged.providers = providers;
  }

  for (const key of CLASS_KEYS) {
    const classList = [...new Set(classes[key])];

    if (classList.length) {
      merged[key] = classList;
    }
  }

  return merged;
};
