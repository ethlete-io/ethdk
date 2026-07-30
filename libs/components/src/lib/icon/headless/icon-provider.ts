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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/consistent-type-definitions
export interface EthleteIconNameRegistry {}

/**
 * Augmentable registry for the literal set of icon variants an app uses. Empty by default,
 * which keeps the `variant` input typed as plain `string`. See {@link EthleteIconNameRegistry}.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/consistent-type-definitions
export interface EthleteIconVariantRegistry {}

export type RegisteredIconName = EthleteIconNameRegistry extends { name: infer N extends string } ? N : string;
export type RegisteredIconVariant = EthleteIconVariantRegistry extends { name: infer V extends string } ? V : string;

/** Variant the {@link IconDirective} falls back to when `etIcon` is used without an explicit `variant`. */
export const DEFAULT_ICON_VARIANT = 'solid';

/** Composite registry key for an icon `name` plus an optional `variant`. */
export const iconRegistryKey = (name: string, variant?: string | null) => (variant ? `${name}::${variant}` : name);

export const ICONS_TOKEN = new InjectionToken<Record<string, IconDefinition>>('ET_ICONS_TOKEN');

/**
 * Application-level icon overrides, merged on top of the icons a component self-registers
 * via {@link provideIcons}. See {@link provideIconOverrides}.
 */
export const ICON_OVERRIDES_TOKEN = new InjectionToken<Record<string, IconDefinition>>('ET_ICON_OVERRIDES_TOKEN');

const buildIconMap = (source: string, icons: IconDefinition[]) => {
  const map: Record<string, IconDefinition> = {};

  for (const def of icons) {
    const key = iconRegistryKey(def.name, def.variant);

    if (map[key]) {
      throw new RuntimeError(
        ICON_ERROR_CODES.DUPLICATE_ICON_NAME,
        `[${source}] Icon with name "${def.name}"${
          def.variant ? ` and variant "${def.variant}"` : ''
        } already exists. Please provide unique icon name/variant combinations.`,
      );
    }

    map[key] = def;
  }

  return map;
};

export const provideIcons = (...icons: IconDefinition[]) => ({
  provide: ICONS_TOKEN,
  useValue: buildIconMap('provideIcons', icons),
});

/**
 * Canonical list of the icon names the SDK ships built-in and renders from its own
 * components (select chevron, picker calendar/clock, close buttons, rich-text tools, …).
 * It's the set you can target with {@link provideIconOverrides} to swap the default artwork.
 *
 * Keep this in sync when adding or removing a built-in `et-*` icon under
 * `libs/components/src/lib/icon/headless/`.
 */
export const ET_BUILT_IN_ICON_NAMES = [
  'et-align-center',
  'et-align-justify',
  'et-align-left',
  'et-align-right',
  'et-arrow-out-up-right',
  'et-arrow-right',
  'et-arrow-up',
  'et-arrows-left-right',
  'et-bold',
  'et-calendar',
  'et-check',
  'et-chevron',
  'et-circle-check',
  'et-circle-info',
  'et-clipboard-check',
  'et-clock',
  'et-code',
  'et-code-block',
  'et-ellipsis',
  'et-ellipsis-vertical',
  'et-eye',
  'et-eye-slash',
  'et-file',
  'et-filter',
  'et-floppy-disk',
  'et-focus-frame',
  'et-grid-2x2',
  'et-heading-1',
  'et-heading-2',
  'et-heading-3',
  'et-image',
  'et-italic',
  'et-link',
  'et-list-bulleted',
  'et-list-numbered',
  'et-lock',
  'et-minus',
  'et-paragraph',
  'et-pause',
  'et-pencil',
  'et-play',
  'et-plus',
  'et-quote',
  'et-redo',
  'et-rotate-right',
  'et-star',
  'et-strikethrough',
  'et-table',
  'et-times',
  'et-triangle-exclamation',
  'et-underline',
  'et-undo',
  'et-upload',
] as const;

/** Union of the SDK's built-in icon names — see {@link ET_BUILT_IN_ICON_NAMES}. */
export type EtBuiltInIconName = (typeof ET_BUILT_IN_ICON_NAMES)[number];

/**
 * An icon passed to {@link provideIconOverrides}. Identical to {@link IconDefinition}, but
 * `name` autocompletes to the built-in {@link EtBuiltInIconName} set (the icons worth
 * overriding) while still accepting any other string for registering brand-new names.
 */
export type IconOverride = Omit<IconDefinition, 'name'> & {
  // `string & {}` keeps the literal suggestions from collapsing to plain `string`.
  name: EtBuiltInIconName | (string & {});
};

/**
 * Overrides the SDK's built-in icons app-wide (or for a subtree). Provide it once in your
 * application providers with icons whose `name`/`variant` match the built-ins you want to
 * replace — e.g. your own Font Awesome set generated via the `@ethlete/components:icons`
 * generator — and every component that renders that icon picks up your version, without
 * touching the component's own `provideIcons()` registration.
 *
 * `name` autocompletes to the built-in {@link ET_BUILT_IN_ICON_NAMES} set, so you don't have
 * to guess which names exist; passing any other string registers a brand-new icon.
 *
 * Overrides are keyed by name/variant and merged *on top of* the component-level registry,
 * so unlisted icons keep their built-in defaults.
 *
 * ```ts
 * // app.config.ts
 * providers: [
 *   provideIconOverrides(
 *     { name: 'et-chevron', data: myChevronSvg },
 *     { name: 'et-times', data: myTimesSvg },
 *   ),
 * ],
 * ```
 */
export const provideIconOverrides = (...icons: IconOverride[]) => ({
  provide: ICON_OVERRIDES_TOKEN,
  useValue: buildIconMap('provideIconOverrides', icons),
});
