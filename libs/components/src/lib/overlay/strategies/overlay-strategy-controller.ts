import {
  DOCUMENT,
  EnvironmentInjector,
  createEnvironmentInjector,
  effect,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import {
  AnimatedLifecycleDirective,
  OverlayRuntimeAnimationDelegate,
  OverlayRuntimePositionStrategy,
  OverlayRuntimeRef,
  animationDebugLog,
  equal,
  injectBreakpointObserver,
  injectRenderer,
  injectStyleManager,
  isHTMLElement,
  nextFrame,
} from '@ethlete/core';
import { tap } from 'rxjs';
import { OverlayConfig } from '../overlay-config';
import { OverlayRef } from '../overlay-ref';
import { findNextRelevantHtmlElement } from './overlay-origin';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyContext } from './overlay-strategy.types';

export type OverlayStrategyControllerMountConfig = {
  positionStrategy: OverlayRuntimePositionStrategy;
  paneClass: string[];
  hostClass: string[];
  animationDelegate: OverlayRuntimeAnimationDelegate;
  renderArrow: boolean;
  hasBackdrop: boolean;
};

export type OverlayStrategyController = {
  /** Values the overlay manager merges into the runtime mount config before mounting. */
  initialMountConfig: OverlayStrategyControllerMountConfig;

  /** Wires strategy lifecycle hooks and breakpoint switching. Must be called right after mounting. */
  attach: (runtimeRef: OverlayRuntimeRef<object, unknown>, overlayRef: OverlayRef<object, unknown>) => void;
};

const normalizeClasses = (value?: string | string[]): string[] => {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
};

/** Set by the overlay container while the overlay is open - see `overlay-container.component.css`. */
const BACKDROP_VISIBLE_CLASS = 'et-overlay-backdrop--visible';

const coerceCssPixelValue = (value: number | string) => {
  return typeof value === 'number' ? `${value}px` : value;
};

export const createOverlayStrategyController = (
  config: OverlayConfig,
  parentInjector: EnvironmentInjector,
): OverlayStrategyController => {
  const childInjector = createEnvironmentInjector([], parentInjector);
  const renderer = runInInjectionContext(childInjector, () => injectRenderer());
  const breakpointObserver = runInInjectionContext(childInjector, () => injectBreakpointObserver());
  const styleManager = runInInjectionContext(childInjector, () => injectStyleManager());

  /** The strategy's CSS ships with the strategy, so it has to be in the document before it renders. */
  const mountStrategyStyles = (strategyConfig: OverlayBreakpointConfig) => {
    if (strategyConfig.stylesComponent) {
      styleManager.mount(strategyConfig.stylesComponent);
    }
  };

  const origin = config.origin;
  // event origins climb to the nearest clickable element (e.g. the button instead of its icon)
  const originElement = isHTMLElement(origin)
    ? origin
    : origin && isHTMLElement(origin.target)
      ? (findNextRelevantHtmlElement(origin.target) ?? origin.target)
      : undefined;

  // The overlay mounts into its origin's document (see the overlay manager), so `documentClass` and
  // `bodyClass` have to land on that document too - scroll locks and the like are for the window the
  // overlay is actually in.
  const document = originElement?.ownerDocument ?? childInjector.get(DOCUMENT);

  const strategyBreakpoints = untracked(() => runInInjectionContext(childInjector, () => config.strategies?.() ?? []));

  const breakpointMatchResults = untracked(() =>
    runInInjectionContext(childInjector, () =>
      strategyBreakpoints.map((breakpointEntry) =>
        breakpointEntry.breakpoint
          ? {
              isActive: breakpointObserver.observeBreakpoint({ min: breakpointEntry.breakpoint }),
              strategy: breakpointEntry.strategy,
              size:
                typeof breakpointEntry.breakpoint === 'number'
                  ? breakpointEntry.breakpoint
                  : breakpointObserver.getBreakpointSize(breakpointEntry.breakpoint, 'min'),
            }
          : {
              isActive: signal(true),
              strategy: breakpointEntry.strategy,
              size: 0,
            },
      ),
    ),
  );

  const getHighestMatchedStrategy = () => {
    const activeBreakpoints = breakpointMatchResults.filter((entry) => entry.isActive());
    return activeBreakpoints.reduce((prev, curr) => (prev.size > curr.size ? prev : curr)).strategy;
  };

  let activeStrategy = untracked(() => getHighestMatchedStrategy());

  mountStrategyStyles(activeStrategy.config);
  let attachedRuntimeRef: OverlayRuntimeRef<object, unknown> | null = null;
  let attachedOverlayRef: OverlayRef<object, unknown> | null = null;

  let cachedLifecycle: AnimatedLifecycleDirective | null = null;

  // the runtime clears the component instance on close, so the lifecycle is cached for onAfterLeave
  const getLifecycle = (): AnimatedLifecycleDirective | null => {
    const instance = attachedRuntimeRef?.componentInstance() as {
      animatedLifecycle?: () => AnimatedLifecycleDirective;
    } | null;

    cachedLifecycle = instance?.animatedLifecycle?.() ?? cachedLifecycle;

    return cachedLifecycle;
  };

  const buildContext = (
    strategyConfig: OverlayBreakpointConfig,
    previousConfig?: OverlayBreakpointConfig,
  ): OverlayStrategyContext | null => {
    const runtimeRef = attachedRuntimeRef;
    const overlayRef = attachedOverlayRef;
    const lifecycle = getLifecycle();

    if (!runtimeRef || !overlayRef || !lifecycle) return null;

    return {
      overlayRef,
      runtimeRef,
      containerEl: runtimeRef.elements.paneElement,
      hostEl: runtimeRef.elements.hostElement,
      backdropEl: runtimeRef.elements.backdropElement(),
      lifecycle,
      config: strategyConfig,
      previousConfig,
      origin,
    };
  };

  const resolvePositionStrategy = (strategyConfig: OverlayBreakpointConfig): OverlayRuntimePositionStrategy => {
    return strategyConfig.positionStrategy?.(originElement) ?? { kind: 'global' };
  };

  const resolveHasBackdrop = (strategyConfig: OverlayBreakpointConfig) => {
    return config.hasBackdrop ?? strategyConfig.hasBackdrop ?? config.mode !== 'non-modal';
  };

  const composeMaxSize = (value: number | string | undefined, cssVar: string) => {
    if (value === undefined) return `var(${cssVar})`;

    const cssValue = coerceCssPixelValue(value);

    return `min(${cssValue}, var(${cssVar}, ${cssValue}))`;
  };

  const composeMinSize = (value: number | string | undefined, cssVar: string) => {
    if (value === undefined) return null;

    const cssValue = coerceCssPixelValue(value);

    return `min(${cssValue}, var(${cssVar}, ${cssValue}))`;
  };

  const applySizingStyles = (paneElement: HTMLElement, strategyConfig: OverlayBreakpointConfig) => {
    renderer.setStyle(paneElement, {
      maxWidth: composeMaxSize(strategyConfig.maxWidth, '--et-overlay-max-width'),
      maxHeight: composeMaxSize(strategyConfig.maxHeight, '--et-overlay-max-height'),
      minWidth: composeMinSize(strategyConfig.minWidth, '--et-overlay-max-width'),
      minHeight: composeMinSize(strategyConfig.minHeight, '--et-overlay-max-height'),
      width: strategyConfig.width ? coerceCssPixelValue(strategyConfig.width) : null,
      height: strategyConfig.height ? coerceCssPixelValue(strategyConfig.height) : null,
    });
  };

  const applyClassChange = (element: HTMLElement, change: { prev?: string | string[]; curr?: string | string[] }) => {
    const { prev, curr } = change;

    if (equal(prev, curr)) return;

    if (prev) {
      renderer.removeClass(element, ...normalizeClasses(prev));
    }

    if (curr) {
      renderer.addClass(element, ...normalizeClasses(curr));
    }
  };

  const applyClasses = (options: {
    runtimeRef: OverlayRuntimeRef<object, unknown>;
    prevConfig: OverlayBreakpointConfig | undefined;
    currConfig: OverlayBreakpointConfig;
  }) => {
    const { runtimeRef, prevConfig, currConfig } = options;
    const { paneElement, hostElement } = runtimeRef.elements;
    const backdropElement = runtimeRef.elements.backdropElement();

    applyClassChange(paneElement, { prev: prevConfig?.containerClass, curr: currConfig.containerClass });
    applyClassChange(hostElement, { prev: prevConfig?.hostClass, curr: currConfig.hostClass });
    applyClassChange(document.documentElement, { prev: prevConfig?.documentClass, curr: currConfig.documentClass });
    applyClassChange(document.body, { prev: prevConfig?.bodyClass, curr: currConfig.bodyClass });

    if (backdropElement) {
      applyClassChange(backdropElement, { prev: prevConfig?.backdropClass, curr: currConfig.backdropClass });
    }
  };

  const removeClassesFromDocumentAndBody = (strategyConfig: OverlayBreakpointConfig) => {
    if (strategyConfig.documentClass) {
      renderer.removeClass(document.documentElement, ...normalizeClasses(strategyConfig.documentClass));
    }

    if (strategyConfig.bodyClass) {
      renderer.removeClass(document.body, ...normalizeClasses(strategyConfig.bodyClass));
    }
  };

  /**
   * A backdrop the switch just added has missed the enter transition that fades one in, so it is
   * faded in from the next frame instead. Must run before `applyClasses`, which puts the strategy's
   * own classes on whatever element exists afterwards.
   */
  const applyBackdrop = (runtimeRef: OverlayRuntimeRef<object, unknown>, strategyConfig: OverlayBreakpointConfig) => {
    const hadBackdrop = !!runtimeRef.elements.backdropElement();

    runtimeRef.updateBackdrop(resolveHasBackdrop(strategyConfig));

    const backdropElement = runtimeRef.elements.backdropElement();
    const lifecycleState = getLifecycle()?.state$.value;
    const isVisible = lifecycleState === 'entering' || lifecycleState === 'entered';

    if (hadBackdrop || !backdropElement || !isVisible) return;

    nextFrame(() => renderer.addClass(backdropElement, BACKDROP_VISIBLE_CLASS));
  };

  const switchStrategy = (currStrategy: OverlayStrategy, prevStrategy: OverlayStrategy) => {
    const runtimeRef = attachedRuntimeRef;
    if (!runtimeRef) return;

    const context = buildContext(currStrategy.config, prevStrategy.config);

    if (context) {
      prevStrategy.onSwitchedAwayFrom?.(context);
      currStrategy.onSwitchedTo?.(context);
    }

    activeStrategy = currStrategy;

    mountStrategyStyles(currStrategy.config);
    applyBackdrop(runtimeRef, currStrategy.config);
    applyClasses({ runtimeRef, prevConfig: prevStrategy.config, currConfig: currStrategy.config });
    runtimeRef.updatePositionStrategy(resolvePositionStrategy(currStrategy.config));
    // re-position clears inline pane styles, so sizing must be re-applied afterwards
    applySizingStyles(runtimeRef.elements.paneElement, currStrategy.config);
  };

  const animationDelegate: OverlayRuntimeAnimationDelegate = {
    enter: ({ lifecycle }) => {
      const strategy = activeStrategy;
      const context = buildContext(strategy.config);

      animationDebugLog(
        `strategy ${config.id}`,
        `delegate enter → ${strategy.onBeforeEnter && context ? 'onBeforeEnter' : 'lifecycle.enter()'}`,
      );

      if (strategy.onBeforeEnter && context) {
        strategy.onBeforeEnter(context);
      } else {
        lifecycle.enter();
      }
    },
    leave: ({ lifecycle }) => {
      const strategy = activeStrategy;
      const context = buildContext(strategy.config);

      animationDebugLog(
        `strategy ${config.id}`,
        `delegate leave → ${strategy.onBeforeLeave && context ? 'onBeforeLeave' : 'lifecycle.leave()'}`,
      );

      if (strategy.onBeforeLeave && context) {
        strategy.onBeforeLeave(context);
      } else {
        lifecycle.leave();
      }
    },
  };

  const attach = (runtimeRef: OverlayRuntimeRef<object, unknown>, overlayRef: OverlayRef<object, unknown>) => {
    attachedRuntimeRef = runtimeRef;
    attachedOverlayRef = overlayRef;

    applySizingStyles(runtimeRef.elements.paneElement, activeStrategy.config);

    const backdropElement = runtimeRef.elements.backdropElement();
    if (backdropElement) {
      applyClassChange(backdropElement, { curr: activeStrategy.config.backdropClass });
    }

    if (activeStrategy.config.documentClass) {
      renderer.addClass(document.documentElement, ...normalizeClasses(activeStrategy.config.documentClass));
    }

    if (activeStrategy.config.bodyClass) {
      renderer.addClass(document.body, ...normalizeClasses(activeStrategy.config.bodyClass));
    }

    runtimeRef
      .afterOpened()
      .pipe(
        tap(() => {
          const strategy = activeStrategy;
          const context = buildContext(strategy.config);

          if (strategy.onAfterEnter && context) {
            strategy.onAfterEnter(context);
          }
        }),
      )
      .subscribe();

    runtimeRef
      .afterClosed()
      .pipe(
        tap(() => {
          const strategy = activeStrategy;
          const context = buildContext(strategy.config);

          if (strategy.onAfterLeave && context) {
            strategy.onAfterLeave(context);
          }

          removeClassesFromDocumentAndBody(strategy.config);
          childInjector.destroy();
        }),
      )
      .subscribe();

    const highestMatchedStrategy = linkedSignal<
      OverlayStrategy,
      {
        currentStrategy: OverlayStrategy;
        previousStrategy: OverlayStrategy | undefined;
      }
    >({
      source: getHighestMatchedStrategy,
      computation: (source, prev) => ({
        currentStrategy: source,
        previousStrategy: prev?.source,
      }),
    });

    let isFirstRun = true;
    untracked(() =>
      effect(
        () => {
          const { currentStrategy, previousStrategy } = highestMatchedStrategy();

          if (isFirstRun) {
            isFirstRun = false;

            return;
          }

          if (!previousStrategy || previousStrategy.id === currentStrategy.id) return;

          untracked(() => switchStrategy(currentStrategy, previousStrategy));
        },
        { injector: childInjector },
      ),
    );
  };

  return {
    initialMountConfig: {
      positionStrategy: resolvePositionStrategy(activeStrategy.config),
      paneClass: normalizeClasses(activeStrategy.config.containerClass),
      hostClass: normalizeClasses(activeStrategy.config.hostClass),
      animationDelegate,
      renderArrow: activeStrategy.config.arrow ?? false,
      hasBackdrop: resolveHasBackdrop(activeStrategy.config),
    },
    attach,
  };
};
