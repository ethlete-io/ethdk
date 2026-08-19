import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  PLATFORM_ID,
  provideEnvironmentInitializer,
  signal,
  Signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationError, Router } from '@angular/router';
import { EMPTY, filter, from, switchMap, timer } from 'rxjs';
import { injectIsDocumentVisible } from '../signals';
import { injectUnsavedChangesCoordinator } from '../unsaved-changes';
import { createSessionMemory, defineRootProvider, defineStaticRootProvider, toInjectFn, toProvideFn } from '../utils';
import { fetchDeployedBuildFingerprint, readBuildFingerprint } from './build-fingerprint';
import { isStaleBuildError } from './stale-build-error';

const RELOADED_AT_KEY = 'et-app-update-reloaded-at';

export type AppUpdatesConfig = {
  /**
   * The document the deployed build is read from - the app's own entry point, whose hashed script
   * filenames are the fingerprint. Point it at a path that always serves the current `index.html`.
   * @default '/'
   */
  entryUrl: string;

  /**
   * How often to look for a new deploy while the tab is in the foreground, in milliseconds. Checking
   * pauses while the tab is hidden and resumes the moment it is looked at again, so a tab left open
   * overnight asks once on return rather than thousands of times in the dark.
   *
   * `0` polls not at all, leaving {@link AppUpdates.check} to the app.
   * @default 300_000
   */
  pollInterval: number;

  /**
   * Floor between two checks, in milliseconds. Without it, alt-tabbing repeatedly would fire a
   * request per switch.
   * @default 30_000
   */
  minCheckInterval: number;

  /**
   * What to do when a lazy chunk fails and this build is therefore broken.
   *
   * `'when-safe'` reloads on its own, but only when no tracked form holds unsaved changes - so the
   * user gets the route they clicked instead of an error, and never loses typing to it. When
   * something is dirty the reload is left to the app to offer (read {@link AppUpdates.isRequired}).
   *
   * `'never'` only reports, and every reload is the app's call.
   * @default 'when-safe'
   */
  autoReload: 'when-safe' | 'never';

  /**
   * How long after an automatic reload another one may happen, in milliseconds. A deploy that is
   * broken for reasons of its own would otherwise reload the tab forever; past this guard the app
   * reports {@link AppUpdates.isRequired} and leaves the decision to the user.
   * @default 60_000
   */
  reloadCooldown: number;
};

export type AppUpdates = {
  /**
   * A different build is deployed. This tab still works - everything it has already loaded keeps
   * running - but it is running yesterday's code.
   */
  isAvailable: Signal<boolean>;

  /**
   * This build is broken: a lazy chunk could not be loaded, so part of the app is unreachable until
   * the tab reloads. Set whether or not a poll has noticed the deploy.
   */
  isRequired: Signal<boolean>;

  /** Whether reloading right now would throw away unsaved changes - the reason an update can't just reload. */
  wouldDiscardChanges: Signal<boolean>;

  /** Checks for a new deploy now, regardless of the poll schedule. */
  check: () => Promise<void>;

  /**
   * Reloads the page, releasing the unsaved-changes tab locks first so the browser does not ask its
   * own "Leave site?" question on top of whatever the app already asked.
   */
  reload: () => void;
};

const APP_UPDATES_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<AppUpdatesConfig>(
  {
    entryUrl: '/',
    pollInterval: 300_000,
    minCheckInterval: 30_000,
    autoReload: 'when-safe',
    reloadCooldown: 60_000,
  },
  { name: 'App Updates Config' },
);

const APP_UPDATES_DEF = /* @__PURE__ */ defineRootProvider(
  (): AppUpdates => {
    const config = injectAppUpdatesConfig();
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    const coordinator = injectUnsavedChangesCoordinator();
    const router = inject(Router, { optional: true });
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    // Read once, at startup: this is the build the tab is running, and it cannot change without a
    // reload. Reading it live would drift as the app appends scripts of its own.
    const runningBuild = isBrowser ? readBuildFingerprint(document) : '';

    const reloadedAt = createSessionMemory<number>({
      key: RELOADED_AT_KEY,
      parse: (storedValue) => Number(storedValue) || null,
      serialize: String,
    });

    const _deployedBuild = signal<string | null>(null);
    const _isRequired = signal(false);

    const isAvailable = computed(() => {
      const deployed = _deployedBuild();

      return !!runningBuild && !!deployed && deployed !== runningBuild;
    });

    let lastCheckAt = 0;

    const check = async () => {
      lastCheckAt = Date.now();

      const deployed = await fetchDeployedBuildFingerprint(config.entryUrl);

      if (deployed) {
        _deployedBuild.set(deployed);
      }
    };

    const checkIfDue = async () => {
      if (Date.now() - lastCheckAt < config.minCheckInterval) {
        return;
      }

      await check();
    };

    const reload = () => {
      // The reload is deliberate and the user has already answered for it, so release every
      // beforeunload lock rather than have the browser ask the same question again.
      coordinator.abandonAll('app-update');
      reloadedAt.write(Date.now());
      document.defaultView?.location.reload();
    };

    const isWithinReloadCooldown = () => {
      const previous = reloadedAt.read();

      return previous !== null && Date.now() - previous < config.reloadCooldown;
    };

    const reportStaleBuild = () => {
      _isRequired.set(true);

      if (config.autoReload !== 'when-safe') {
        return;
      }

      if (untracked(coordinator.hasUnsavedChanges) || isWithinReloadCooldown()) {
        return;
      }

      reload();
    };

    if (isBrowser) {
      const window = document.defaultView;

      const handleRejection = (event: PromiseRejectionEvent) => {
        if (isStaleBuildError(event.reason)) {
          reportStaleBuild();
        }
      };

      const handleError = (event: ErrorEvent) => {
        if (isStaleBuildError(event.error ?? event.message)) {
          reportStaleBuild();
        }
      };

      window?.addEventListener('unhandledrejection', handleRejection);
      window?.addEventListener('error', handleError);

      destroyRef.onDestroy(() => {
        window?.removeEventListener('unhandledrejection', handleRejection);
        window?.removeEventListener('error', handleError);
      });

      // A lazy route's import is awaited by the router, which turns the rejection into a
      // NavigationError - so it never reaches the unhandledrejection listener above.
      router?.events
        .pipe(
          filter((event): event is NavigationError => event instanceof NavigationError),
          filter((event) => isStaleBuildError(event.error)),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe(reportStaleBuild);

      if (config.pollInterval > 0) {
        const isDocumentVisible = injectIsDocumentVisible();

        toObservable(isDocumentVisible)
          .pipe(
            switchMap((isVisible) => (isVisible ? timer(0, config.pollInterval) : EMPTY)),
            switchMap(() => from(checkIfDue())),
            takeUntilDestroyed(destroyRef),
          )
          .subscribe();
      }
    }

    return {
      isAvailable,
      isRequired: _isRequired.asReadonly(),
      wouldDiscardChanges: coordinator.hasUnsavedChanges,
      check,
      reload,
    };
  },
  { name: 'App Updates' },
);

export const provideAppUpdatesConfig = /* @__PURE__ */ toProvideFn(APP_UPDATES_CONFIG_DEF);
export const injectAppUpdatesConfig = /* @__PURE__ */ toInjectFn(APP_UPDATES_CONFIG_DEF);

export const provideAppUpdatesInstance = /* @__PURE__ */ toProvideFn(APP_UPDATES_DEF);
export const injectAppUpdates = /* @__PURE__ */ toInjectFn(APP_UPDATES_DEF);

/**
 * Keeps a long-lived tab from breaking on a deploy.
 *
 * A tab loaded before a deploy still holds the old build's `index.html`, and the chunks it has not
 * imported yet are gone from the server - so the next click on a lazy route dies with a chunk that
 * 404s, or one the SPA fallback answered with HTML. This watches for both halves of that: it polls
 * the entry document for a new deploy while the tab is in the foreground, and it listens for the
 * import failure itself, reloading when nothing would be lost.
 *
 * Nothing has to be generated at build time - the deployed build is identified by the hashed script
 * filenames in its own `index.html`.
 *
 * ```ts
 * provideAppUpdates({ entryUrl: '/index.html' });
 * ```
 *
 * Read {@link AppUpdates.isAvailable} to offer a reload, and {@link AppUpdates.isRequired} for the
 * case where this build is already broken and a reload is the only way on.
 */
export const provideAppUpdates = (config?: Partial<AppUpdatesConfig>) => [
  ...provideAppUpdatesConfig(config),
  ...provideAppUpdatesInstance(),
  provideEnvironmentInitializer(() => void injectAppUpdates()),
];
