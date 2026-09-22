import {
  DestroyRef,
  EffectRef,
  Injector,
  ViewContainerRef,
  WritableSignal,
  effect,
  inject,
  inputBinding,
  isSignal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { injectQueryParam } from '@ethlete/core';
import { take, tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';
import { mergeOverlayConfigs } from './overlay-config-merger';
import {
  OVERLAY_QUERY_PARAM_INPUT_NAME,
  OverlayDefinition,
  QueryParamOverlayDefinition,
  QueryParamOverlayValue,
} from './overlay-definition';
import { injectOverlayManager } from './overlay-manager';
import { OverlayRef } from './overlay-ref';

/** Per-open config overrides. The component and `strategies` are fixed by the definition. */
export type OverlayOpenConfig = Omit<OverlayConfig, 'strategies'>;

export type OverlayLifecycleConfig<TResult = unknown> = {
  /** A callback function to be executed once the overlay has been closed */
  afterClosed?: (result: TResult | null) => void;

  /** A callback function to be executed before the overlay is closed */
  beforeClosed?: (result: TResult | null) => void;

  /** A callback function to be executed once the overlay has been opened */
  afterOpened?: () => void;
};

/**
 * Lifecycle callbacks plus overlay config overrides applied on every open. The config is merged
 * additively on top of the definition's config (`bindings`, `providers` and class lists are
 * concatenated; scalars override).
 *
 * Note for query-param overlays: an `origin` set here anchors every URL-driven open, including
 * deep links where the originating element may not exist - omitting it is usually right (the
 * overlay then falls back to the currently focused element).
 */
export type OverlayOpenerConfig<TResult = unknown> = OverlayLifecycleConfig<TResult> & OverlayOpenConfig;

/**
 * Per-open config for a standard opener: config overrides plus lifecycle callbacks that apply to
 * this open only, in addition to the opener's own callbacks.
 */
export type OverlayOpenerOpenConfig<TResult = unknown> = OverlayOpenConfig & OverlayLifecycleConfig<TResult>;

export type OverlayOpener<TComponent extends object = object, TResult = unknown> = {
  /** Open the overlay. Per-open config is merged additively on top of the definition and opener configs. */
  open: (config?: OverlayOpenerOpenConfig<TResult>) => OverlayRef<TComponent, TResult>;
};

export type SingleOverlayOpener<TComponent extends object = object, TResult = unknown> = {
  /**
   * Open the overlay, replacing the one the slot has open. Returns `null` while the previous overlay
   * is still deciding whether to close (e.g. a pending unsaved-changes confirm) - the open then runs
   * once it closes with source `'replace'`, and is dropped if it closes any other way.
   */
  open: (config?: OverlayOpenerOpenConfig<TResult>) => OverlayRef<TComponent, TResult> | null;
};

/**
 * One open overlay shared by several single openers, created with {@link createOverlaySingleSlot}.
 * Opening through any of them replaces the overlay any of them has open.
 */
export type OverlaySingleSlot = {
  /** @internal */
  open: (openFn: () => OverlayRef | null) => OverlayRef | null;
};

/**
 * Creates a slot that lets several single openers share one open overlay:
 * `createOverlayOpener(a, { single: slot })` and `createOverlayOpener(b, { single: slot })`.
 */
export const createOverlaySingleSlot = (): OverlaySingleSlot => {
  let current: OverlayRef | null = null;
  let waiting: (() => OverlayRef | null) | null = null;

  const track = (ref: OverlayRef | null) => {
    current = ref;

    ref
      ?.beforeClosedEvent()
      .pipe(
        take(1),
        tap((event) => {
          if (current !== ref) return;

          current = null;

          const next = waiting;
          waiting = null;

          if (next && event.source === 'replace') track(next());
        }),
      )
      .subscribe();

    return ref;
  };

  const open = (openFn: () => OverlayRef | null) => {
    const previous = current;

    if (!previous) return track(openFn());

    waiting = openFn;
    previous.closeVia('replace');

    return current !== previous ? current : null;
  };

  return { open };
};

export type OverlaySingleOpenerConfig<TResult = unknown> = OverlayOpenerConfig<TResult> & {
  /**
   * Keep at most one overlay of this opener open: `open()` closes the open one with source
   * `'replace'` (guardable, e.g. by `createOverlayUnsavedChangesGuard`) and opens the new one once it
   * does. Pass an {@link OverlaySingleSlot} instead to share the one overlay across several openers.
   */
  single: 'replace' | OverlaySingleSlot;
};

export type QueryParamOverlayOpener<TQueryParam extends string = string> = {
  /** Open the overlay by writing the given value to the query param. */
  open: (value: TQueryParam) => void;

  /** Close the overlay by removing the query param. */
  close: () => void;
};

type CreateOverlayOpenerFn = {
  <TComponent extends object, TResult>(
    definition: QueryParamOverlayDefinition<TComponent, TResult>,
    config?: OverlayOpenerConfig<TResult>,
  ): QueryParamOverlayOpener<QueryParamOverlayValue<TComponent>>;
  <TComponent extends object, TResult>(
    definition: OverlayDefinition<TComponent, TResult>,
    config: OverlaySingleOpenerConfig<TResult>,
  ): SingleOverlayOpener<TComponent, TResult>;
  <TComponent extends object, TResult>(
    definition: OverlayDefinition<TComponent, TResult>,
    config?: OverlayOpenerConfig<TResult>,
  ): OverlayOpener<TComponent, TResult>;
};

const isWritableSignal = <T>(value: unknown): value is WritableSignal<T> =>
  isSignal(value) && typeof (value as { set?: unknown }).set === 'function';

const splitOpenerConfig = <TResult>(config: OverlayOpenerConfig<TResult> | undefined) => {
  const { afterClosed, beforeClosed, afterOpened, ...overlayConfig } = config ?? {};

  const lifecycle: OverlayLifecycleConfig<TResult> = { afterClosed, beforeClosed, afterOpened };

  return { lifecycle, overlayConfig };
};

type AttachLifecycleOptions<TComponent extends object, TResult> = {
  overlayRef: OverlayRef<TComponent, TResult>;
  lifecycle: OverlayLifecycleConfig<TResult>;
  destroyRef: DestroyRef;
};

const attachLifecycle = <TComponent extends object, TResult>(options: AttachLifecycleOptions<TComponent, TResult>) => {
  const { overlayRef, lifecycle, destroyRef } = options;
  const { afterClosed, beforeClosed, afterOpened } = lifecycle;

  if (afterClosed) {
    overlayRef
      .afterClosed()
      .pipe(
        takeUntilDestroyed(destroyRef),
        tap((result) => afterClosed(result ?? null)),
      )
      .subscribe();
  }

  if (beforeClosed) {
    overlayRef
      .beforeClosed()
      .pipe(
        takeUntilDestroyed(destroyRef),
        tap((result) => beforeClosed(result ?? null)),
      )
      .subscribe();
  }

  if (afterOpened) {
    overlayRef
      .afterOpened()
      .pipe(
        takeUntilDestroyed(destroyRef),
        tap(() => afterOpened()),
      )
      .subscribe();
  }
};

const createStandardOverlayOpener = <TComponent extends object, TResult>(
  definition: OverlayDefinition<TComponent, TResult>,
  openerConfig?: OverlayOpenerConfig<TResult> | OverlaySingleOpenerConfig<TResult>,
): OverlayOpener<TComponent, TResult> | SingleOverlayOpener<TComponent, TResult> => {
  const overlayManager = injectOverlayManager();
  const destroyRef = inject(DestroyRef);
  const fallbackViewContainerRef = inject(ViewContainerRef, { optional: true }) ?? undefined;
  const { single, ...sharedConfig } = (openerConfig ?? {}) as Partial<OverlaySingleOpenerConfig<TResult>>;
  const { lifecycle, overlayConfig } = splitOpenerConfig(sharedConfig);
  const slot = single === 'replace' ? createOverlaySingleSlot() : (single ?? null);

  let destroyed = false;
  destroyRef.onDestroy(() => (destroyed = true));

  const openNow = (config?: OverlayOpenerOpenConfig<TResult>) => {
    const { lifecycle: openLifecycle, overlayConfig: openConfig } = splitOpenerConfig(config);

    const overlayRef = overlayManager.open<TComponent, TResult>(
      definition.component,
      mergeOverlayConfigs({ viewContainerRef: fallbackViewContainerRef }, definition.config, overlayConfig, openConfig),
    );

    attachLifecycle({ overlayRef, lifecycle, destroyRef });
    attachLifecycle({ overlayRef, lifecycle: openLifecycle, destroyRef });

    return overlayRef;
  };

  if (!slot) return { open: openNow };

  return {
    open: (config) =>
      slot.open(() => (destroyed ? null : (openNow(config) as unknown as OverlayRef))) as OverlayRef<
        TComponent,
        TResult
      > | null,
  };
};

const createQueryParamOverlayOpener = <TComponent extends object, TResult>(
  definition: QueryParamOverlayDefinition<TComponent, TResult>,
  openerConfig?: OverlayOpenerConfig<TResult>,
): QueryParamOverlayOpener => {
  const overlayManager = injectOverlayManager();
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);
  const fallbackViewContainerRef = inject(ViewContainerRef, { optional: true }) ?? undefined;
  const queryParamValue = injectQueryParam(definition.queryParamKey);
  const { lifecycle, overlayConfig } = splitOpenerConfig(openerConfig);

  let overlayRef: OverlayRef<TComponent, TResult> | null = null;
  let modelSyncEffect: EffectRef | null = null;

  const updateQueryParam = (value: string | null) =>
    router.navigate([], { queryParams: { [definition.queryParamKey]: value }, queryParamsHandling: 'merge' });

  const queryParamModel = () => {
    const instance = overlayRef?.componentInstance() as Record<string, unknown> | null;

    return isWritableSignal<string>(instance?.[OVERLAY_QUERY_PARAM_INPUT_NAME])
      ? (instance[OVERLAY_QUERY_PARAM_INPUT_NAME] as WritableSignal<string>)
      : null;
  };

  const teardown = () => {
    modelSyncEffect?.destroy();
    modelSyncEffect = null;
  };

  // The consumer's callbacks and the URL-sync wiring are composed into a single lifecycle
  // config so each open attaches exactly one set of subscriptions.
  const composedLifecycle: OverlayLifecycleConfig<TResult> = {
    afterClosed: lifecycle.afterClosed,
    afterOpened: () => {
      lifecycle.afterOpened?.();

      const model = queryParamModel();

      if (!model) return;

      // Keep the URL in sync when the overlay writes to its model.
      modelSyncEffect = effect(
        () => {
          const modelValue = model();
          untracked(() => updateQueryParam(modelValue));
        },
        { injector },
      );
    },
    beforeClosed: (result) => {
      lifecycle.beforeClosed?.(result);

      teardown();
      overlayRef = null;
      updateQueryParam(null);
    },
  };

  const openOverlay = (value: string) => {
    // The seeded query-param binding is the last merge layer so it wins over any conflicting
    // binding from the definition or opener config; two-way sync is wired up in afterOpened.
    const ref = overlayManager.open<TComponent, TResult>(
      definition.component,
      mergeOverlayConfigs({ viewContainerRef: fallbackViewContainerRef }, definition.config, overlayConfig, {
        bindings: [inputBinding(OVERLAY_QUERY_PARAM_INPUT_NAME, () => value)],
      }),
    );

    attachLifecycle({ overlayRef: ref, lifecycle: composedLifecycle, destroyRef });

    overlayRef = ref;
  };

  effect(() => {
    const value = queryParamValue();

    untracked(() => {
      if (!value) {
        overlayRef?.close();

        return;
      }

      if (overlayRef) {
        // The overlay is already open and the param changed externally - push it into the model.
        queryParamModel()?.set(value);

        return;
      }

      openOverlay(value);
    });
  });

  destroyRef.onDestroy(() => {
    teardown();

    const openRef = overlayRef;

    if (!openRef) return;

    overlayRef = null;

    // clearing the param is what normally closes the overlay, but the effect doing that is destroyed
    // with this context - and the overlay outlives it, so it has to be closed directly
    openRef.close();
    updateQueryParam(null);
  });

  return {
    open: (value) => updateQueryParam(value),
    close: () => updateQueryParam(null),
  };
};

/**
 * Creates an opener for the given overlay definition. Must be called in an injection context.
 *
 * - For a `defineOverlay` definition the opener exposes `open(config?)`, returning the typed
 *   `OverlayRef`. With `single: 'replace'` it keeps at most one overlay open and `open()` returns
 *   `OverlayRef | null` - see {@link OverlaySingleOpenerConfig}.
 * - For a `defineQueryParamOverlay` definition the opener drives the overlay through the URL:
 *   `open(value)` writes the query param and `close()` clears it. It also reacts to external
 *   URL changes (deep links, browser navigation) for as long as the injection context lives.
 *
 * @example
 * readonly product = createOverlayOpener(productOverlay, {
 *   afterClosed: (result) => console.log(result),
 * });
 */
export const createOverlayOpener: CreateOverlayOpenerFn = ((
  definition: OverlayDefinition | QueryParamOverlayDefinition,
  config?: OverlayOpenerConfig,
) =>
  definition.kind === 'queryParamOverlay'
    ? createQueryParamOverlayOpener(definition, config)
    : createStandardOverlayOpener(definition, config)) as CreateOverlayOpenerFn;
