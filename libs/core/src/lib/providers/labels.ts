import { computed, inject, InjectionToken, Provider, Signal } from '@angular/core';
import { injectLocale } from './locale';

/**
 * A label set, or a function building one for a locale. The function form is called again whenever
 * {@link injectLocale}'s `currentLocale` changes, so a locale switch re-renders the wording without
 * reloading — that is the seam an app's i18n library plugs into.
 */
export type LabelsSource<T> = Partial<T> | ((locale: string) => Partial<T>);

/** What {@link createLabels} returns. */
export type LabelsResult<T> = readonly [
  provide: (labels: LabelsSource<T>) => Provider,
  inject: () => Signal<T>,
  token: InjectionToken<LabelsSource<T>>,
];

const resolveSource = <T>(source: T | ((locale: string) => T), locale: string): T =>
  typeof source === 'function' ? (source as (locale: string) => T)(locale) : source;

/**
 * The one mechanism for the strings a component renders or announces itself. Every domain in the UI
 * library that has such strings exposes exactly this pair — `provide<Domain>Labels` to localize a
 * subtree, `inject<Domain>Labels()` to read the result — so localizing an app is the same move
 * repeated per domain rather than a different one each time.
 *
 * `defaults` may itself be locale-derived, for a domain that ships more than one language (the
 * `@ethlete/query` error tables, say). Overrides are partial and layer on top of whatever the locale
 * resolved to, so translating into a third language while keeping a shipped one as the base is the
 * same call.
 *
 * The injector returns a **signal**, because both halves can change at runtime — read it in a
 * template or computed, never destructure it once.
 *
 * @example
 * export type BreadcrumbLabels = { navigation: string; overflow: string };
 *
 * export const DEFAULT_BREADCRUMB_LABELS: BreadcrumbLabels = {
 *   navigation: 'Breadcrumb',
 *   overflow: 'Show hidden levels',
 * };
 *
 * export const [provideBreadcrumbLabels, injectBreadcrumbLabels, BREADCRUMB_LABELS] =
 *   createLabels<BreadcrumbLabels>('BREADCRUMB_LABELS', DEFAULT_BREADCRUMB_LABELS);
 *
 * @example
 * // consumer, fixed wording
 * provideBreadcrumbLabels({ navigation: 'Brotkrumen' });
 *
 * // consumer, driven by the app's i18n and re-resolved on a locale change
 * provideBreadcrumbLabels((locale) => ({ navigation: translate('breadcrumb.nav', locale) }));
 */
export const createLabels = <T extends object>(
  name: string,
  defaults: T | ((locale: string) => T),
): LabelsResult<T> => {
  const token = new InjectionToken<LabelsSource<T>>(name, {
    providedIn: 'root',
    factory: () => ({}),
  });

  const provide = (labels: LabelsSource<T>): Provider => ({ provide: token, useValue: labels });

  const injectFn = (): Signal<T> => {
    const source = inject(token);
    const { currentLocale } = injectLocale();

    return computed(() => {
      const locale = currentLocale();

      return { ...resolveSource(defaults, locale), ...resolveSource(source, locale) };
    });
  };

  return [provide, injectFn, token] as const;
};
