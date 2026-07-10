import { InjectionToken } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { ICON_ERROR_CODES } from './icon-errors';

export type IconDefinition = {
  name: string;
  /**
   * Optional style variant (e.g. `'solid'`, `'light'`, `'regular'`). Lets the same icon
   * `name` exist in several styles without encoding the style into the name. Icons
   * registered without a variant are matched by their bare name.
   */
  variant?: string;
  data: string;
};

/**
 * Augmentable registry for the literal set of icon names an app uses. Empty by default,
 * which keeps `etIcon` typed as plain `string`. The `@ethlete/components:icons` generator
 * writes an augmentation for this interface, or you can augment it manually:
 *
 * ```ts
 * declare module '@ethlete/components' {
 *   interface EthleteIconNameRegistry {
 *     name: 'shield' | 'plus';
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EthleteIconNameRegistry {}

/**
 * Augmentable registry for the literal set of icon variants an app uses. Empty by default,
 * which keeps the `variant` input typed as plain `string`. See {@link EthleteIconNameRegistry}.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EthleteIconVariantRegistry {}

export type RegisteredIconName = EthleteIconNameRegistry extends { name: infer N extends string } ? N : string;
export type RegisteredIconVariant = EthleteIconVariantRegistry extends { name: infer V extends string } ? V : string;

/** Variant the {@link IconDirective} falls back to when `etIcon` is used without an explicit `variant`. */
export const DEFAULT_ICON_VARIANT = 'solid';

/** Composite registry key for an icon `name` plus an optional `variant`. */
export const iconRegistryKey = (name: string, variant?: string | null) => (variant ? `${name}::${variant}` : name);

export const ICONS_TOKEN = new InjectionToken<Record<string, IconDefinition>>('ET_ICONS_TOKEN');

export const provideIcons = (...icons: IconDefinition[]) => {
  const map: Record<string, IconDefinition> = {};

  for (const def of icons) {
    const key = iconRegistryKey(def.name, def.variant);

    if (map[key]) {
      throw new RuntimeError(
        ICON_ERROR_CODES.DUPLICATE_ICON_NAME,
        `[provideIcons] Icon with name "${def.name}"${
          def.variant ? ` and variant "${def.variant}"` : ''
        } already exists. Please provide unique icon name/variant combinations.`,
      );
    }

    map[key] = def;
  }

  return {
    provide: ICONS_TOKEN,
    useValue: map,
  };
};
