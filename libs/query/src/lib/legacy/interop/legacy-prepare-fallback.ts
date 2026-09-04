import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  Injector,
  isDevMode,
  makeEnvironmentProviders,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';

const fallbackInjectors = /* @__PURE__ */ new Set<Injector>();

/**
 * The stashed root injector, or `null` when the fallback was never provided (or was provided on the
 * server, where stashing is refused). With several applications on one page it is the one that
 * registered first, until that application is destroyed.
 *
 * @internal
 */
export const legacyPrepareFallbackInjector = (): Injector | null => fallbackInjectors.values().next().value ?? null;

/**
 * Lets `prepare()` fall back to the application's root injector when it is called outside any injection
 * context, instead of throwing `ET950`.
 *
 * Opt-in, and **browser only**. Two things degrade when the fallback is used, both matching v2, which had
 * no injector to scope to at all:
 *
 * - **The query's lifetime becomes the application's.** Nothing tears it down when a component dies, so
 *   cleanup rests entirely on a query container or `config: { destroyOnResponse: true }`.
 * - **The devtools lose the host element**, so "inspect" cannot jump to the component. Already the case
 *   for any query created from a root or environment injector.
 *
 * It refuses to stash anything on the server: a module-global injector would be shared across concurrent
 * requests, which is data bleed rather than a leak. Server-side renders keep throwing `ET950`, so a call
 * site that only works in the browser fails loudly where it matters.
 *
 * With several applications on one page it stays a single module-global slot: the application that
 * provided it first answers every `prepare()` made outside an injection context, whichever application
 * made the call, until that application is destroyed. Dev mode warns when a second one registers.
 *
 * Prefer passing `injector` at the call site - it keeps the query scoped to whatever created it. Reach for
 * this when a migration has too many call sites to thread by hand.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideLegacyPrepareFallback()],
 * });
 * ```
 *
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const provideLegacyPrepareFallback = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) {
        if (isDevMode()) {
          console.warn(
            'provideLegacyPrepareFallback() does nothing on the server: a module-global injector would be shared ' +
              'between concurrent requests. prepare() calls without an injection context keep throwing ET950 there.',
          );
        }

        return;
      }

      const injector = inject(EnvironmentInjector);

      fallbackInjectors.add(injector);

      if (isDevMode() && fallbackInjectors.size > 1) {
        console.warn(
          'provideLegacyPrepareFallback() was provided by more than one application on this page. There is a ' +
            'single module-global slot, so prepare() calls without an injection context resolve against the ' +
            'application that provided it first - including calls made from the other applications.',
        );
      }

      inject(DestroyRef).onDestroy(() => {
        fallbackInjectors.delete(injector);
      });
    }),
  ]);
