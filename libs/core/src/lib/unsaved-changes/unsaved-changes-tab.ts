import { isPlatformBrowser } from '@angular/common';
import {
  assertInInjectionContext,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { injectFaviconStore, injectTitleStore } from '../seo';
import { injectIsDocumentVisible } from '../signals';

/** The default tab title marker — a filled dot, prefixed while there are unsaved changes. */
export const UNSAVED_CHANGES_TITLE_MARKER = '●';

/**
 * How an unsaved-changes tracker surfaces itself on the browser tab.
 *
 * Only the `beforeunload` lock is on by default — the title marker and the app badge write to
 * app-global surfaces, so they are opt-in.
 */
export type UnsavedChangesTabConfig = {
  /**
   * Make the browser ask for confirmation before the tab is closed, reloaded, or navigated away from
   * while there are unsaved changes (`beforeunload`).
   *
   * The prompt is the browser's own — its wording cannot be customized, and browsers only show it
   * after the user has interacted with the page at least once (sticky activation). The listener is
   * attached **only while changes exist**, so a clean page stays eligible for the back/forward cache.
   * @default true
   */
  lock?: boolean;

  /**
   * Prefix the tab title with a marker while there are unsaved changes. `true` uses
   * {@link UNSAVED_CHANGES_TITLE_MARKER}, a string is used as-is.
   *
   * Goes through the core title store (`injectTitleStore`), so the app's title must be owned by it
   * (`applyHeadTitleBinding` / the `etSeo` directive) — an app that writes `document.title` by some
   * other means would fight the store over it.
   * @default false
   */
  titleMarker?: boolean | string;

  /**
   * Blink the tab while there are unsaved changes: the title marker (and the favicon dot, if enabled)
   * is toggled on and off — the closest thing the web has to an "attention needed" tab flash, since no
   * browser exposes one. Implies `titleMarker` when that isn't set.
   *
   * By default it only blinks while the tab is **in the background** (`whenHidden`), which is the case
   * worth flagging — a title blinking in the tab the user is already reading is just noise. `interval`
   * is in ms and defaults to 1000; going faster is pointless because browsers clamp timers in hidden
   * tabs to roughly one second.
   * @default false
   */
  flash?: boolean | { interval?: number; whenHidden?: boolean };

  /**
   * Draw a dot on the site's favicon while there are unsaved changes, via the
   * [favicon store](/core/seo#favicon). Pass a color to override the theme accent.
   * @default false
   */
  favicon?: boolean | { color?: string };

  /**
   * Show an app badge while there are unsaved changes (Badging API). `true` shows a plain dot, a
   * number shows that count.
   *
   * The badge is a per-app surface, not a per-tab one: it is only visible when the app is installed
   * (PWA / desktop shortcut) and pinned, and it is a silent no-op everywhere else. Counts from
   * several trackers add up; the badge is cleared once the last one is clean.
   * @default false
   */
  badge?: boolean | number;
};

export type CreateUnsavedChangesTabLockConfig = UnsavedChangesTabConfig & {
  /** Whether there are unsaved changes right now — typically a tracker's `hasChanges`. */
  hasChanges: Signal<boolean>;
};

export type UnsavedChangesTabLockRef = {
  /**
   * Release the lock and remove the title marker / app badge. Also runs automatically when the
   * injector that created the lock is destroyed.
   */
  destroy: () => void;
};

type BadgingNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

// The badge is a single app-wide surface, so every lock that wants one registers here and the badge
// is derived from all of them — otherwise the first tracker to go clean would clear a badge that
// another one still needs.
const BADGE_HOLDERS = /* @__PURE__ */ new Map<symbol, number | true>();

const syncAppBadge = () => {
  const nav = typeof navigator === 'undefined' ? null : (navigator as BadgingNavigator);

  if (!nav?.setAppBadge || !nav.clearAppBadge) {
    return;
  }

  // Unsupported, or not installed — the promise rejects instead of throwing synchronously.
  const ignore = () => undefined;

  if (!BADGE_HOLDERS.size) {
    nav.clearAppBadge().catch(ignore);

    return;
  }

  const count = Array.from(BADGE_HOLDERS.values()).reduce<number>(
    (total, contents) => (typeof contents === 'number' ? total + contents : total),
    0,
  );

  // `setAppBadge()` without a count renders a plain dot.
  nav.setAppBadge(count || undefined).catch(ignore);
};

/**
 * The browser-tab flavor of the unsaved-changes family: while `hasChanges` reads `true`, the tab
 * cannot be closed or reloaded without the browser's confirm prompt, and — opt in — the tab title
 * carries a marker (optionally blinking), the favicon carries a dot, and the installed app carries a
 * badge.
 *
 * Every {@link createUnsavedChangesTracker} sets this up automatically (lock only); reach for it
 * directly when you track "unsaved" state that isn't a form, or want to lock the tab from a signal
 * you already have. Call from an injection context.
 *
 * ```ts
 * createUnsavedChangesTabLock({
 *   hasChanges: computed(() => this.uploads().some((u) => u.pending)),
 *   titleMarker: true,
 *   flash: true,
 * });
 * ```
 */
export const createUnsavedChangesTabLock = (config: CreateUnsavedChangesTabLockConfig): UnsavedChangesTabLockRef => {
  assertInInjectionContext(createUnsavedChangesTabLock);

  const { hasChanges } = config;
  const lock = config.lock ?? true;
  const flash = config.flash === true ? {} : config.flash || null;
  const favicon = config.favicon === true ? {} : config.favicon || null;
  const badge = config.badge ?? false;

  // Blinking needs something to blink, so it implies the default marker.
  const titleMarker =
    config.titleMarker === true
      ? UNSAVED_CHANGES_TITLE_MARKER
      : (config.titleMarker ?? (flash && !favicon ? UNSAVED_CHANGES_TITLE_MARKER : null));

  const destroyRef = inject(DestroyRef);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  const releaseFns: (() => void)[] = [];

  // The blink phase. Always `true` unless flashing is on, so the marker/favicon effects below can read
  // one signal either way.
  const flashPhase = signal(true);

  if (isBrowser && flash) {
    const interval = flash.interval ?? 1000;
    const whenHidden = flash.whenHidden ?? true;
    const isDocumentVisible = injectIsDocumentVisible();
    const shouldFlash = computed(() => hasChanges() && (!whenHidden || !isDocumentVisible()));

    const flashEffect = effect((onCleanup) => {
      if (!shouldFlash()) {
        return;
      }

      const handle = setInterval(() => flashPhase.update((on) => !on), interval);

      onCleanup(() => {
        clearInterval(handle);
        flashPhase.set(true);
      });
    });

    releaseFns.push(() => {
      flashEffect.destroy();
      flashPhase.set(true);
    });
  }

  /** Dirty, and in the "shown" half of a blink. */
  const isMarked = computed(() => hasChanges() && flashPhase());

  if (titleMarker) {
    const titleStore = injectTitleStore();
    const markerId = Symbol('unsaved-changes-title-marker');

    const markerEffect = effect(() => {
      const marked = isMarked();

      untracked(() => (marked ? titleStore.addMarker(markerId, titleMarker) : titleStore.removeMarker(markerId)));
    });

    releaseFns.push(() => {
      markerEffect.destroy();
      titleStore.removeMarker(markerId);
    });
  }

  if (isBrowser && favicon) {
    const faviconStore = injectFaviconStore();
    const overlayId = Symbol('unsaved-changes-favicon');

    const faviconEffect = effect(() => {
      const marked = isMarked();

      untracked(() =>
        marked
          ? faviconStore.addOverlay(overlayId, { kind: 'dot', color: favicon.color })
          : faviconStore.removeOverlay(overlayId),
      );
    });

    releaseFns.push(() => {
      faviconEffect.destroy();
      faviconStore.removeOverlay(overlayId);
    });
  }

  if (isBrowser && lock) {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();

      // Legacy Chrome / Safari gate the prompt on a truthy `returnValue` rather than on
      // `preventDefault()`. Deprecated, but still the only way to reach those engines.
      event.returnValue = true;
    };

    let attached = false;

    const attach = () => {
      if (attached) return;

      attached = true;
      window.addEventListener('beforeunload', onBeforeUnload);
    };

    const detach = () => {
      if (!attached) return;

      attached = false;
      window.removeEventListener('beforeunload', onBeforeUnload);
    };

    // Attached only while there are changes: a permanently registered `beforeunload` listener makes
    // the page ineligible for the back/forward cache, which would slow every back navigation.
    const lockEffect = effect(() => {
      const dirty = hasChanges();

      untracked(() => (dirty ? attach() : detach()));
    });

    releaseFns.push(() => {
      lockEffect.destroy();
      detach();
    });
  }

  if (isBrowser && badge !== false) {
    const badgeId = Symbol('unsaved-changes-badge');
    const contents = badge === true ? true : badge;

    const badgeEffect = effect(() => {
      const dirty = hasChanges();

      untracked(() => {
        if (dirty) {
          BADGE_HOLDERS.set(badgeId, contents);
        } else {
          BADGE_HOLDERS.delete(badgeId);
        }

        syncAppBadge();
      });
    });

    releaseFns.push(() => {
      badgeEffect.destroy();
      BADGE_HOLDERS.delete(badgeId);
      syncAppBadge();
    });
  }

  const destroy = () => {
    while (releaseFns.length) {
      releaseFns.pop()?.();
    }
  };

  destroyRef.onDestroy(destroy);

  return { destroy };
};
