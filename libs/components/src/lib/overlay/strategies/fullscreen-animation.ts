import { ApplicationRef, ComponentRef, EnvironmentInjector, createComponent } from '@angular/core';
import {
  AngularRenderer,
  RuntimeError,
  animationDebugLog,
  forceReflow,
  matchesReducedMotion,
  nextFrame,
} from '@ethlete/core';
import { filter, take, tap, timer } from 'rxjs';
import { OVERLAY_ERROR_CODES } from '../overlay-errors';
import { getOriginCoordinatesAndDimensions } from './overlay-origin';
import { OverlayOriginCloneComponent } from './overlay-origin-clone.component';
import { OverlayStrategyContext } from './overlay-strategy.types';

export type ViewportTransformData = {
  viewportWidth: number;
  viewportHeight: number;
  rect: DOMRect;
  scaleUpX: number;
  scaleUpY: number;
  viewportCenterX: number;
  viewportCenterY: number;
  buttonCenterX: number;
  buttonCenterY: number;
  cloneTranslateX: number;
  cloneTranslateY: number;
  containerTranslateX: number;
  containerTranslateY: number;
  scaleX: number;
  scaleY: number;
};

export type FullscreenAnimationCancellable = {
  unsubscribe: () => void;
};

export type FullscreenAnimationState = {
  readonly originElement: HTMLElement | null;
  readonly cloneComponentRef: ComponentRef<OverlayOriginCloneComponent> | null;
  readonly subscriptions: FullscreenAnimationCancellable[];
  readonly isOriginHidden: boolean;
};

export type FullscreenAnimationDeps = {
  readonly injector: EnvironmentInjector;
  readonly document: Document;
  readonly appRef: ApplicationRef;
  readonly renderer: AngularRenderer;
};

const REDUCED_ANIMATION_THRESHOLD_WIDTH = 1000;
const REDUCED_ANIMATION_SCALE = 0.75;
const CLONE_ANIMATION_TIMEOUT_MS = 500;

const REDUCED_ANIMATION_CLASS = 'et-overlay--full-screen-dialog--reduced-animation';

const ORIGIN_ATTR_OPACITY = 'data-et-origin-opacity';
const ORIGIN_ATTR_TRANSITION = 'data-et-origin-transition';
const ORIGIN_ATTR_HIDDEN_COUNT = 'data-et-origin-hidden-count';

const captureOriginStyles = (renderer: AngularRenderer, element: HTMLElement) => {
  if (!element.hasAttribute(ORIGIN_ATTR_OPACITY)) {
    renderer.setAttribute(element, ORIGIN_ATTR_OPACITY, element.style.opacity);
    renderer.setAttribute(element, ORIGIN_ATTR_TRANSITION, element.style.transition);
  }
};

const getHiddenCount = (element: HTMLElement) => {
  const count = element.getAttribute(ORIGIN_ATTR_HIDDEN_COUNT);
  return count ? parseInt(count, 10) : 0;
};

const incrementHiddenCount = (renderer: AngularRenderer, element: HTMLElement) => {
  const count = getHiddenCount(element);
  renderer.setAttribute(element, ORIGIN_ATTR_HIDDEN_COUNT, String(count + 1));
};

const decrementHiddenCount = (renderer: AngularRenderer, element: HTMLElement) => {
  const count = getHiddenCount(element);
  const newCount = Math.max(0, count - 1);

  if (newCount === 0) {
    renderer.removeAttribute(element, ORIGIN_ATTR_HIDDEN_COUNT);
  } else {
    renderer.setAttribute(element, ORIGIN_ATTR_HIDDEN_COUNT, String(newCount));
  }

  return newCount;
};

const getOriginalStyles = (element: HTMLElement): { opacity: string; transition: string } => {
  return {
    opacity: element.getAttribute(ORIGIN_ATTR_OPACITY) ?? '',
    transition: element.getAttribute(ORIGIN_ATTR_TRANSITION) ?? '',
  };
};

const clearOriginAttributes = (renderer: AngularRenderer, element: HTMLElement) => {
  renderer.removeAttribute(element, ORIGIN_ATTR_OPACITY, ORIGIN_ATTR_TRANSITION, ORIGIN_ATTR_HIDDEN_COUNT);
};

const getViewportSize = (document: Document) => {
  const visualViewport = (document.defaultView as Window | null)?.visualViewport;

  if (visualViewport) {
    return { width: visualViewport.width, height: visualViewport.height };
  }

  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
};

const calculateViewportTransforms = (originElement: HTMLElement, document: Document): ViewportTransformData => {
  const { width: viewportWidth, height: viewportHeight } = getViewportSize(document);
  const rect = originElement.getBoundingClientRect();

  const scaleUpX = viewportWidth / rect.width;
  const scaleUpY = viewportHeight / rect.height;

  const viewportCenterX = viewportWidth / 2;
  const viewportCenterY = viewportHeight / 2;

  const buttonCenterX = rect.left + rect.width / 2;
  const buttonCenterY = rect.top + rect.height / 2;

  const cloneTranslateX = viewportCenterX - buttonCenterX;
  const cloneTranslateY = viewportCenterY - buttonCenterY;

  const containerTranslateX = buttonCenterX - viewportCenterX;
  const containerTranslateY = buttonCenterY - viewportCenterY;

  const scaleX = rect.width / viewportWidth;
  const scaleY = rect.height / viewportHeight;

  return {
    viewportWidth,
    viewportHeight,
    rect,
    scaleUpX,
    scaleUpY,
    viewportCenterX,
    viewportCenterY,
    buttonCenterX,
    buttonCenterY,
    cloneTranslateX,
    cloneTranslateY,
    containerTranslateX,
    containerTranslateY,
    scaleX,
    scaleY,
  };
};

const shouldUseReducedAnimation = (options: {
  document: Document;
  originElement: HTMLElement | null;
  applyTransformOrigin: boolean;
}) => {
  const viewportWidth = options.document.documentElement.clientWidth;

  if (matchesReducedMotion(options.document.documentElement)) return true;
  if (viewportWidth >= REDUCED_ANIMATION_THRESHOLD_WIDTH) return true;
  if (!options.originElement) return true;
  if (!options.applyTransformOrigin) return true;

  return false;
};

const applyCloneElementStyles = (options: {
  renderer: AngularRenderer;
  cloneEl: HTMLElement;
  rect: DOMRect;
  transforms: Pick<ViewportTransformData, 'cloneTranslateX' | 'cloneTranslateY' | 'scaleUpX' | 'scaleUpY'>;
}) => {
  const { renderer, cloneEl, rect, transforms } = options;

  renderer.setStyle(cloneEl, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });

  renderer.setCssProperties(cloneEl, {
    '--enter-from-translate-x': '0px',
    '--enter-from-translate-y': '0px',
    '--enter-from-scale-x': '1',
    '--enter-from-scale-y': '1',
    '--enter-to-translate-x': `${transforms.cloneTranslateX}px`,
    '--enter-to-translate-y': `${transforms.cloneTranslateY}px`,
    '--enter-to-scale-x': `${transforms.scaleUpX}`,
    '--enter-to-scale-y': `${transforms.scaleUpY}`,
    '--leave-from-translate-x': `${transforms.cloneTranslateX}px`,
    '--leave-from-translate-y': `${transforms.cloneTranslateY}px`,
    '--leave-from-scale-x': `${transforms.scaleUpX}`,
    '--leave-from-scale-y': `${transforms.scaleUpY}`,
    '--leave-to-translate-x': '0px',
    '--leave-to-translate-y': '0px',
    '--leave-to-scale-x': '1',
    '--leave-to-scale-y': '1',
  });
};

const applyContainerElementStyles = (options: {
  renderer: AngularRenderer;
  containerEl: HTMLElement;
  rect: DOMRect;
  transforms: Pick<ViewportTransformData, 'scaleX' | 'scaleY' | 'containerTranslateX' | 'containerTranslateY'>;
}) => {
  const { renderer, containerEl, rect, transforms } = options;

  renderer.setCssProperties(containerEl, {
    '--origin-width': `${rect.width}px`,
    '--origin-height': `${rect.height}px`,
    '--origin-scale-x': `${transforms.scaleX}`,
    '--origin-scale-y': `${transforms.scaleY}`,
    '--origin-translate-x': `${transforms.containerTranslateX}px`,
    '--origin-translate-y': `${transforms.containerTranslateY}px`,
  });
};

const applyReducedAnimationStyles = (options: {
  renderer: AngularRenderer;
  containerEl: HTMLElement;
  originElement: HTMLElement | null;
  applyTransformOrigin: boolean;
  document: Document;
}) => {
  const { renderer, containerEl, originElement, applyTransformOrigin, document } = options;

  renderer.setCssProperties(containerEl, {
    '--origin-scale-x': `${REDUCED_ANIMATION_SCALE}`,
    '--origin-scale-y': `${REDUCED_ANIMATION_SCALE}`,
    '--origin-translate-x': '0px',
    '--origin-translate-y': '0px',
  });

  // Apply transform origin if we have an origin element
  if (originElement && applyTransformOrigin) {
    const rect = originElement.getBoundingClientRect();
    const { width: viewportWidth, height: viewportHeight } = getViewportSize(document);

    // Calculate transform origin as percentage from viewport center
    const originX = ((rect.left + rect.width / 2) / viewportWidth) * 100;
    const originY = ((rect.top + rect.height / 2) / viewportHeight) * 100;

    renderer.setStyle(containerEl, { transformOrigin: `${originX}% ${originY}%` });
  } else {
    renderer.setStyle(containerEl, { transformOrigin: 'center center' });
  }

  renderer.addClass(containerEl, REDUCED_ANIMATION_CLASS);
};

const removeReducedAnimationClass = (renderer: AngularRenderer, containerEl: HTMLElement) => {
  renderer.removeClass(containerEl, REDUCED_ANIMATION_CLASS);
};

export const cleanupFullscreenAnimationStyles = (options: {
  containerEl: HTMLElement;
  renderer: AngularRenderer;
  state: FullscreenAnimationState | null;
}) => {
  const { containerEl, renderer, state } = options;

  removeReducedAnimationClass(renderer, containerEl);

  renderer.setCssProperties(containerEl, {
    '--origin-width': null,
    '--origin-height': null,
    '--origin-scale-x': null,
    '--origin-scale-y': null,
    '--origin-translate-x': null,
    '--origin-translate-y': null,
  });

  renderer.setStyle(containerEl, { transformOrigin: null });

  if (state?.originElement && state.isOriginHidden) {
    restoreOriginElement(renderer, state.originElement);
  }
};

// Reparented into the clone host, the content has lost the layout context that sized it - a grid
// cell, a flex parent, a percentage against a scroll container - so it has to be pinned to the
// measured box. Left alone it re-derives an intrinsic size and re-resolves its own `%` offsets
// against the host, and the clone stops matching the element it came from.
const pinClonedContentToRect = (options: { renderer: AngularRenderer; content: HTMLElement; rect: DOMRect }) => {
  const { renderer, content, rect } = options;

  renderer.setStyle(content, {
    inset: '0',
    boxSizing: 'border-box',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
};

const updateCloneLeaveAnimationStyles = (options: {
  renderer: AngularRenderer;
  cloneEl: HTMLElement;
  rect: DOMRect;
  transforms: Pick<ViewportTransformData, 'cloneTranslateX' | 'cloneTranslateY' | 'scaleUpX' | 'scaleUpY'>;
}) => {
  const { renderer, cloneEl, rect, transforms } = options;

  renderer.setStyle(cloneEl, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });

  const clonedContent = cloneEl.firstElementChild;

  if (clonedContent instanceof HTMLElement) {
    pinClonedContentToRect({ renderer, content: clonedContent, rect });
  }

  renderer.setCssProperties(cloneEl, {
    '--leave-from-translate-x': `${transforms.cloneTranslateX}px`,
    '--leave-from-translate-y': `${transforms.cloneTranslateY}px`,
    '--leave-from-scale-x': `${transforms.scaleUpX}`,
    '--leave-from-scale-y': `${transforms.scaleUpY}`,
    '--leave-to-translate-x': '0px',
    '--leave-to-translate-y': '0px',
    '--leave-to-scale-x': '1',
    '--leave-to-scale-y': '1',
  });
};

const createOriginClone = (options: {
  originElement: HTMLElement;
  rect: DOMRect;
  deps: FullscreenAnimationDeps;
}): ComponentRef<OverlayOriginCloneComponent> => {
  const { originElement, rect, deps } = options;
  const { injector, appRef, document, renderer } = deps;

  const cloneComponentRef = createComponent(OverlayOriginCloneComponent, {
    environmentInjector: injector,
  });

  const clonedContent = originElement.cloneNode(true) as HTMLElement;
  const computedStyle = document.defaultView?.getComputedStyle(originElement);

  renderer.setStyle(clonedContent, {
    margin: '0',
    position: 'relative',
    display: computedStyle?.display ?? null,
  });

  pinClonedContentToRect({ renderer, content: clonedContent, rect });

  renderer.appendChild(cloneComponentRef.location.nativeElement, clonedContent);

  appRef.attachView(cloneComponentRef.hostView);
  renderer.appendChild(document.body, cloneComponentRef.location.nativeElement);

  return cloneComponentRef;
};

const hideOriginElement = (renderer: AngularRenderer, element: HTMLElement) => {
  captureOriginStyles(renderer, element);
  incrementHiddenCount(renderer, element);

  renderer.setStyle(element, {
    transition: 'none',
    opacity: '0',
  });
};

const restoreOriginElement = (renderer: AngularRenderer, element: HTMLElement) => {
  const remainingCount = decrementHiddenCount(renderer, element);

  if (remainingCount === 0) {
    const { opacity, transition } = getOriginalStyles(element);

    renderer.setStyle(element, {
      transition: 'none',
      opacity: opacity || null,
    });

    forceReflow(element);

    nextFrame(() => {
      renderer.setStyle(element, {
        transition: transition || null,
      });
    });

    clearOriginAttributes(renderer, element);
  }
};

const createInitialState = (origin: HTMLElement | Event | undefined): FullscreenAnimationState => {
  const originData = getOriginCoordinatesAndDimensions(origin);
  const originElement = originData?.element ?? null;

  return {
    originElement,
    cloneComponentRef: null,
    subscriptions: [],
    isOriginHidden: false,
  };
};

const unsubscribeAll = (state: FullscreenAnimationState) => {
  state.subscriptions.forEach((sub) => sub.unsubscribe());
};

const runAnimationFrame = (element: HTMLElement, callback: () => void): FullscreenAnimationCancellable => {
  let isCancelled = false;

  forceReflow(element);

  nextFrame(() => {
    if (isCancelled) return;

    callback();
  });

  return {
    unsubscribe: () => {
      isCancelled = true;
    },
  };
};

const destroyClone = (cloneComponentRef: ComponentRef<OverlayOriginCloneComponent> | null, appRef: ApplicationRef) => {
  if (cloneComponentRef && !cloneComponentRef.hostView.destroyed) {
    appRef.detachView(cloneComponentRef.hostView);
    cloneComponentRef.destroy();
  }
};

export const startFullscreenEnterAnimation = (options: {
  context: OverlayStrategyContext;
  deps: FullscreenAnimationDeps;
  applyTransformOrigin: boolean;
  skipAnimation: boolean;
}): FullscreenAnimationState => {
  const { context, deps, applyTransformOrigin, skipAnimation } = options;
  const { containerEl, lifecycle } = context;
  const { renderer, document } = deps;

  const state = createInitialState(context.origin);

  const useReduced = shouldUseReducedAnimation({ document, originElement: state.originElement, applyTransformOrigin });

  animationDebugLog('fullscreen', `enter start (reduced ${useReduced}, skipAnimation ${skipAnimation})`);

  if (useReduced) {
    applyReducedAnimationStyles({
      renderer,
      containerEl,
      originElement: state.originElement,
      applyTransformOrigin,
      document,
    });

    if (skipAnimation) {
      lifecycle.forceEnteredState();
    } else {
      state.subscriptions.push(runAnimationFrame(containerEl, () => lifecycle.enter()));
    }

    return state;
  }

  removeReducedAnimationClass(renderer, containerEl);

  if (!state.originElement) {
    throw new RuntimeError(
      OVERLAY_ERROR_CODES.MISSING_ANIMATION_ORIGIN,
      '[startFullscreenEnterAnimation] The full-screen enter animation grows the overlay out of its origin element, so it cannot run without one. Pass `origin` in the overlay config, or let the strategy fall back to the reduced animation.',
      { context },
    );
  }

  const transforms = calculateViewportTransforms(state.originElement, document);
  const cloneComponentRef = createOriginClone({ originElement: state.originElement, rect: transforms.rect, deps });
  const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

  applyCloneElementStyles({ renderer, cloneEl, rect: transforms.rect, transforms });
  applyContainerElementStyles({ renderer, containerEl, rect: transforms.rect, transforms });
  renderer.setStyle(containerEl, { transformOrigin: 'center center' });

  const mutableState = { isOriginHidden: false };

  const newState: FullscreenAnimationState = {
    ...state,
    cloneComponentRef,
    get isOriginHidden() {
      return mutableState.isOriginHidden;
    },
  };

  if (skipAnimation) {
    cloneComponentRef.instance.animatedLifecycle.forceEnteredState();
    lifecycle.forceEnteredState();
    hideOriginElement(renderer, state.originElement);
    mutableState.isOriginHidden = true;
  } else {
    newState.subscriptions.push(
      runAnimationFrame(cloneEl, () => {
        cloneComponentRef.instance.animatedLifecycle.enter();
        lifecycle.enter();
        hideOriginElement(renderer, state.originElement as HTMLElement);
        mutableState.isOriginHidden = true;
      }),
    );
  }

  return newState;
};

export const startFullscreenLeaveAnimation = (options: {
  context: OverlayStrategyContext;
  state: FullscreenAnimationState;
  deps: FullscreenAnimationDeps;
  applyTransformOrigin: boolean;
}): FullscreenAnimationState => {
  const { context, state, deps, applyTransformOrigin } = options;
  const { containerEl, lifecycle } = context;
  const { renderer, document } = deps;

  unsubscribeAll(state);

  const useReduced = shouldUseReducedAnimation({ document, originElement: state.originElement, applyTransformOrigin });

  animationDebugLog('fullscreen', `leave start (reduced ${useReduced}, lifecycle state "${lifecycle.state$.value}")`);

  if (useReduced) {
    destroyClone(state.cloneComponentRef, deps.appRef);

    if (state.originElement && state.isOriginHidden) {
      restoreOriginElement(renderer, state.originElement);
    }

    applyReducedAnimationStyles({
      renderer,
      containerEl,
      originElement: state.originElement,
      applyTransformOrigin,
      document,
    });
    lifecycle.leave();

    return {
      ...state,
      cloneComponentRef: null,
      subscriptions: [],
      isOriginHidden: false,
    };
  }

  removeReducedAnimationClass(renderer, containerEl);

  if (!state.originElement) {
    lifecycle.leave();

    return state;
  }

  const transforms = calculateViewportTransforms(state.originElement, document);

  let { cloneComponentRef } = state;
  let isOriginHidden = state.isOriginHidden;

  if (!cloneComponentRef) {
    cloneComponentRef = createOriginClone({ originElement: state.originElement, rect: transforms.rect, deps });
    const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

    applyCloneElementStyles({ renderer, cloneEl, rect: transforms.rect, transforms });
    applyContainerElementStyles({ renderer, containerEl, rect: transforms.rect, transforms });
    renderer.setStyle(containerEl, { transformOrigin: 'center center' });

    cloneComponentRef.instance.animatedLifecycle.forceEnteredState();
    forceReflow(cloneEl);

    hideOriginElement(renderer, state.originElement);
    isOriginHidden = true;

    nextFrame(() => {
      cloneComponentRef?.instance.animatedLifecycle.leave();
      lifecycle.leave();
    });

    return {
      ...state,
      cloneComponentRef,
      subscriptions: [],
      isOriginHidden,
    };
  } else {
    const cloneState = cloneComponentRef.instance.animatedLifecycle.state$.value;

    if (cloneState === 'init') {
      destroyClone(cloneComponentRef, deps.appRef);

      if (isOriginHidden) {
        restoreOriginElement(renderer, state.originElement);
        isOriginHidden = false;
      } else {
        hideOriginElement(renderer, state.originElement);
        isOriginHidden = true;
      }

      applyReducedAnimationStyles({
        renderer,
        containerEl,
        originElement: state.originElement,
        applyTransformOrigin,
        document,
      });
      lifecycle.leave();

      return {
        ...state,
        cloneComponentRef: null,
        subscriptions: [],
        isOriginHidden,
      };
    }

    if (cloneState === 'entering') {
      const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

      updateCloneLeaveAnimationStyles({ renderer, cloneEl, rect: transforms.rect, transforms });
      applyContainerElementStyles({ renderer, containerEl, rect: transforms.rect, transforms });

      if (!isOriginHidden) {
        hideOriginElement(renderer, state.originElement);
        isOriginHidden = true;
      }

      cloneComponentRef.instance.animatedLifecycle.leave();
      lifecycle.leave();

      return {
        ...state,
        cloneComponentRef,
        subscriptions: [],
        isOriginHidden,
      };
    }

    if (cloneState !== 'entered') {
      cloneComponentRef.instance.animatedLifecycle.forceEnteredState();
    }

    if (!isOriginHidden) {
      hideOriginElement(renderer, state.originElement);
      isOriginHidden = true;
    }
  }

  const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

  updateCloneLeaveAnimationStyles({ renderer, cloneEl, rect: transforms.rect, transforms });
  applyContainerElementStyles({ renderer, containerEl, rect: transforms.rect, transforms });

  cloneComponentRef.instance.animatedLifecycle.leave();
  lifecycle.leave();

  return {
    ...state,
    cloneComponentRef,
    subscriptions: [],
    isOriginHidden,
  };
};

export const cleanupFullscreenAnimation = (state: FullscreenAnimationState, deps: FullscreenAnimationDeps) => {
  const { renderer, appRef } = deps;

  unsubscribeAll(state);

  const isActuallyHidden = state.originElement ? getHiddenCount(state.originElement) > 0 : false;

  if (state.cloneComponentRef && !isActuallyHidden) {
    destroyClone(state.cloneComponentRef, appRef);

    return;
  }

  const restoreOrigin = () => {
    if (state.originElement && isActuallyHidden) {
      restoreOriginElement(renderer, state.originElement);
    }
  };

  if (!state.cloneComponentRef) {
    restoreOrigin();

    return;
  }

  const cloneRef = state.cloneComponentRef;

  if (cloneRef.hostView.destroyed) {
    restoreOrigin();

    return;
  }

  const cloneState = cloneRef.instance.animatedLifecycle.state$.value;

  if (cloneState === 'left') {
    destroyClone(cloneRef, appRef);
    restoreOrigin();

    return;
  }

  if (cloneState === 'leaving') {
    let cleaned = false;

    const doCleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      destroyClone(cloneRef, appRef);
      restoreOrigin();
    };

    const stateSub = cloneRef.instance.animatedLifecycle.state$
      .pipe(
        filter((s) => s === 'left'),
        take(1),
        tap(() => doCleanup()),
      )
      .subscribe();

    const timeoutSub = timer(CLONE_ANIMATION_TIMEOUT_MS)
      .pipe(
        tap(() => {
          stateSub.unsubscribe();
          doCleanup();
        }),
      )
      .subscribe();

    stateSub.add(() => timeoutSub.unsubscribe());

    return;
  }

  destroyClone(cloneRef, appRef);
  restoreOrigin();
};

export const abortFullscreenAnimation = (options: {
  context: OverlayStrategyContext;
  state: FullscreenAnimationState;
  deps: FullscreenAnimationDeps;
}) => {
  const { context, state, deps } = options;
  const { renderer, appRef } = deps;

  unsubscribeAll(state);
  destroyClone(state.cloneComponentRef, appRef);

  cleanupFullscreenAnimationStyles({ containerEl: context.containerEl, renderer, state });
};
