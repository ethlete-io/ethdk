import { ApplicationRef, ComponentRef, EnvironmentInjector, createComponent } from '@angular/core';
import { AngularRenderer, forceReflow, nextFrame } from '@ethlete/core';
import { Subscription, filter, take, timer } from 'rxjs';
import { getOriginCoordinatesAndDimensions } from './overlay-origin';
import { OverlayOriginCloneComponent } from './overlay-origin-clone.component';
import { OverlayStrategyContext } from './types';

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

export type FullscreenAnimationState = {
  readonly originElement: HTMLElement | null;
  readonly cloneComponentRef: ComponentRef<OverlayOriginCloneComponent> | null;
  readonly subscriptions: Subscription[];
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

const captureOriginStyles = (element: HTMLElement): void => {
  if (!element.hasAttribute(ORIGIN_ATTR_OPACITY)) {
    element.setAttribute(ORIGIN_ATTR_OPACITY, element.style.opacity);
    element.setAttribute(ORIGIN_ATTR_TRANSITION, element.style.transition);
  }
};

const getHiddenCount = (element: HTMLElement): number => {
  const count = element.getAttribute(ORIGIN_ATTR_HIDDEN_COUNT);
  return count ? parseInt(count, 10) : 0;
};

const incrementHiddenCount = (element: HTMLElement): void => {
  const count = getHiddenCount(element);
  element.setAttribute(ORIGIN_ATTR_HIDDEN_COUNT, String(count + 1));
};

const decrementHiddenCount = (element: HTMLElement): number => {
  const count = getHiddenCount(element);
  const newCount = Math.max(0, count - 1);

  if (newCount === 0) {
    element.removeAttribute(ORIGIN_ATTR_HIDDEN_COUNT);
  } else {
    element.setAttribute(ORIGIN_ATTR_HIDDEN_COUNT, String(newCount));
  }

  return newCount;
};

const getOriginalStyles = (element: HTMLElement): { opacity: string; transition: string } => {
  return {
    opacity: element.getAttribute(ORIGIN_ATTR_OPACITY) ?? '',
    transition: element.getAttribute(ORIGIN_ATTR_TRANSITION) ?? '',
  };
};

const clearOriginAttributes = (element: HTMLElement): void => {
  element.removeAttribute(ORIGIN_ATTR_OPACITY);
  element.removeAttribute(ORIGIN_ATTR_TRANSITION);
  element.removeAttribute(ORIGIN_ATTR_HIDDEN_COUNT);
};

const calculateViewportTransforms = (originElement: HTMLElement): ViewportTransformData => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
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

const shouldUseReducedAnimation = (
  document: Document,
  originElement: HTMLElement | null,
  applyTransformOrigin: boolean,
): boolean => {
  const viewportWidth = document.documentElement.clientWidth;

  if (viewportWidth >= REDUCED_ANIMATION_THRESHOLD_WIDTH) return true;
  if (!originElement) return true;
  if (!applyTransformOrigin) return true;

  return false;
};

const applyCloneElementStyles = (
  renderer: AngularRenderer,
  cloneEl: HTMLElement,
  rect: DOMRect,
  transforms: Pick<ViewportTransformData, 'cloneTranslateX' | 'cloneTranslateY' | 'scaleUpX' | 'scaleUpY'>,
) => {
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

const applyContainerElementStyles = (
  renderer: AngularRenderer,
  containerEl: HTMLElement,
  rect: DOMRect,
  transforms: Pick<ViewportTransformData, 'scaleX' | 'scaleY' | 'containerTranslateX' | 'containerTranslateY'>,
) => {
  renderer.setCssProperties(containerEl, {
    '--origin-width': `${rect.width}px`,
    '--origin-height': `${rect.height}px`,
    '--origin-scale-x': `${transforms.scaleX}`,
    '--origin-scale-y': `${transforms.scaleY}`,
    '--origin-translate-x': `${transforms.containerTranslateX}px`,
    '--origin-translate-y': `${transforms.containerTranslateY}px`,
  });
};

const applyReducedAnimationStyles = (
  renderer: AngularRenderer,
  containerEl: HTMLElement,
  originElement: HTMLElement | null,
  applyTransformOrigin: boolean,
) => {
  renderer.setCssProperties(containerEl, {
    '--origin-scale-x': `${REDUCED_ANIMATION_SCALE}`,
    '--origin-scale-y': `${REDUCED_ANIMATION_SCALE}`,
    '--origin-translate-x': '0px',
    '--origin-translate-y': '0px',
  });

  // Apply transform origin if we have an origin element
  if (originElement && applyTransformOrigin) {
    const rect = originElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

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

export const cleanupFullscreenAnimationStyles = (
  containerEl: HTMLElement,
  renderer: AngularRenderer,
  state: FullscreenAnimationState | null,
): void => {
  removeReducedAnimationClass(renderer, containerEl);

  renderer.setCssProperties(containerEl, {
    '--origin-width': null,
    '--origin-height': null,
    '--origin-scale-x': null,
    '--origin-scale-y': null,
    '--origin-translate-x': null,
    '--origin-translate-y': null,
  });

  console.log('bee');

  renderer.setStyle(containerEl, { transformOrigin: null });

  if (state?.originElement && state.isOriginHidden) {
    restoreOriginElement(renderer, state.originElement);
  }
};

const updateCloneLeaveAnimationStyles = (
  renderer: AngularRenderer,
  cloneEl: HTMLElement,
  rect: DOMRect,
  transforms: Pick<ViewportTransformData, 'cloneTranslateX' | 'cloneTranslateY' | 'scaleUpX' | 'scaleUpY'>,
) => {
  renderer.setStyle(cloneEl, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });

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

const createOriginClone = (
  originElement: HTMLElement,
  deps: FullscreenAnimationDeps,
): ComponentRef<OverlayOriginCloneComponent> => {
  const { injector, appRef, document, renderer } = deps;

  const cloneComponentRef = createComponent(OverlayOriginCloneComponent, {
    environmentInjector: injector,
  });

  const clonedContent = originElement.cloneNode(true) as HTMLElement;
  const computedStyle = window.getComputedStyle(originElement);

  renderer.setStyle(clonedContent, {
    margin: '0',
    position: 'relative',
    boxSizing: computedStyle.boxSizing,
    display: computedStyle.display,
  });

  cloneComponentRef.location.nativeElement.appendChild(clonedContent);

  appRef.attachView(cloneComponentRef.hostView);
  document.body.appendChild(cloneComponentRef.location.nativeElement);

  return cloneComponentRef;
};

const hideOriginElement = (renderer: AngularRenderer, element: HTMLElement): void => {
  captureOriginStyles(element);
  incrementHiddenCount(element);

  renderer.setStyle(element, {
    transition: 'none',
    opacity: '0',
  });
};

const restoreOriginElement = (renderer: AngularRenderer, element: HTMLElement): void => {
  const remainingCount = decrementHiddenCount(element);

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

    clearOriginAttributes(element);
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

const unsubscribeAll = (state: FullscreenAnimationState): void => {
  state.subscriptions.forEach((sub) => sub.unsubscribe());
};

const destroyClone = (
  cloneComponentRef: ComponentRef<OverlayOriginCloneComponent> | null,
  appRef: ApplicationRef,
): void => {
  if (cloneComponentRef && !cloneComponentRef.hostView.destroyed) {
    appRef.detachView(cloneComponentRef.hostView);
    cloneComponentRef.destroy();
  }
};

export const startFullscreenEnterAnimation = <T, R>(
  context: OverlayStrategyContext<T, R>,
  deps: FullscreenAnimationDeps,
  applyTransformOrigin: boolean,
  skipAnimation: boolean,
): FullscreenAnimationState => {
  const { containerEl, containerInstance } = context;
  const { renderer } = deps;

  const state = createInitialState(context.origin);

  const useReduced = shouldUseReducedAnimation(deps.document, state.originElement, applyTransformOrigin);

  if (useReduced) {
    applyReducedAnimationStyles(renderer, containerEl, state.originElement, applyTransformOrigin);

    if (skipAnimation) {
      containerInstance.animatedLifecycle.forceEnteredState();
    } else {
      const sub = containerInstance.isContentAttached$
        .pipe(
          filter((a) => a),
          take(1),
        )
        .subscribe(() => {
          forceReflow(containerEl);
          nextFrame(() => containerInstance.animatedLifecycle.enter());
        });

      state.subscriptions.push(sub);
    }

    return state;
  }

  removeReducedAnimationClass(renderer, containerEl);

  if (!state.originElement) {
    throw new Error('Origin element is required for full animation');
  }

  const transforms = calculateViewportTransforms(state.originElement);
  const cloneComponentRef = createOriginClone(state.originElement, deps);
  const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

  applyCloneElementStyles(renderer, cloneEl, transforms.rect, transforms);
  applyContainerElementStyles(renderer, containerEl, transforms.rect, transforms);
  renderer.setStyle(containerEl, { transformOrigin: 'center center' });

  const mutableState = { isOriginHidden: false, isCancelled: false };

  const newState: FullscreenAnimationState = {
    ...state,
    cloneComponentRef,
    get isOriginHidden() {
      return mutableState.isOriginHidden;
    },
  };

  if (skipAnimation) {
    cloneComponentRef.instance.animatedLifecycle.forceEnteredState();
    containerInstance.animatedLifecycle.forceEnteredState();
    hideOriginElement(renderer, state.originElement);
    mutableState.isOriginHidden = true;
  } else {
    const sub = containerInstance.isContentAttached$
      .pipe(
        filter((a) => a),
        take(1),
      )
      .subscribe(() => {
        if (mutableState.isCancelled) return;

        forceReflow(cloneEl);

        nextFrame(() => {
          if (mutableState.isCancelled) return;

          cloneComponentRef.instance.animatedLifecycle.enter();
          containerInstance.animatedLifecycle.enter();
          hideOriginElement(renderer, state.originElement!);
          mutableState.isOriginHidden = true;
        });
      });

    const wrappedSub = {
      unsubscribe: () => {
        mutableState.isCancelled = true;
        sub.unsubscribe();
      },
    } as Subscription;

    newState.subscriptions.push(wrappedSub);
  }

  return newState;
};

export const startFullscreenLeaveAnimation = <T, R>(
  context: OverlayStrategyContext<T, R>,
  state: FullscreenAnimationState,
  deps: FullscreenAnimationDeps,
  applyTransformOrigin: boolean,
): FullscreenAnimationState => {
  const { containerEl, containerInstance } = context;
  const { renderer } = deps;

  unsubscribeAll(state);

  const useReduced = shouldUseReducedAnimation(deps.document, state.originElement, applyTransformOrigin);

  if (useReduced) {
    destroyClone(state.cloneComponentRef, deps.appRef);

    if (state.originElement && state.isOriginHidden) {
      restoreOriginElement(renderer, state.originElement);
    }

    applyReducedAnimationStyles(renderer, containerEl, state.originElement, applyTransformOrigin);
    containerInstance.animatedLifecycle.leave();

    return {
      ...state,
      cloneComponentRef: null,
      subscriptions: [],
      isOriginHidden: false,
    };
  }

  removeReducedAnimationClass(renderer, containerEl);

  if (!state.originElement) {
    containerInstance.animatedLifecycle.leave();
    return state;
  }

  const transforms = calculateViewportTransforms(state.originElement);

  let { cloneComponentRef } = state;
  let isOriginHidden = state.isOriginHidden;

  if (!cloneComponentRef) {
    cloneComponentRef = createOriginClone(state.originElement, deps);
    const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

    applyCloneElementStyles(renderer, cloneEl, transforms.rect, transforms);
    applyContainerElementStyles(renderer, containerEl, transforms.rect, transforms);
    renderer.setStyle(containerEl, { transformOrigin: 'center center' });

    cloneComponentRef.instance.animatedLifecycle.forceEnteredState();
    forceReflow(cloneEl);

    hideOriginElement(renderer, state.originElement);
    isOriginHidden = true;

    nextFrame(() => {
      cloneComponentRef?.instance.animatedLifecycle.leave();
      containerInstance.animatedLifecycle.leave();
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
      } else if (!isOriginHidden) {
        hideOriginElement(renderer, state.originElement);
        isOriginHidden = true;
      }

      applyReducedAnimationStyles(renderer, containerEl, state.originElement, applyTransformOrigin);
      containerInstance.animatedLifecycle.leave();

      return {
        ...state,
        cloneComponentRef: null,
        subscriptions: [],
        isOriginHidden,
      };
    }

    if (cloneState === 'entering') {
      const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

      updateCloneLeaveAnimationStyles(renderer, cloneEl, transforms.rect, transforms);
      applyContainerElementStyles(renderer, containerEl, transforms.rect, transforms);

      if (!isOriginHidden) {
        hideOriginElement(renderer, state.originElement);
        isOriginHidden = true;
      }

      cloneComponentRef.instance.animatedLifecycle.leave();
      containerInstance.animatedLifecycle.leave();

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

  updateCloneLeaveAnimationStyles(renderer, cloneEl, transforms.rect, transforms);
  applyContainerElementStyles(renderer, containerEl, transforms.rect, transforms);

  cloneComponentRef.instance.animatedLifecycle.leave();
  containerInstance.animatedLifecycle.leave();

  return {
    ...state,
    cloneComponentRef,
    subscriptions: [],
    isOriginHidden,
  };
};

export const cleanupFullscreenAnimation = (state: FullscreenAnimationState, deps: FullscreenAnimationDeps): void => {
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
      )
      .subscribe(() => {
        doCleanup();
      });

    const timeoutSub = timer(CLONE_ANIMATION_TIMEOUT_MS).subscribe(() => {
      stateSub.unsubscribe();
      doCleanup();
    });

    stateSub.add(() => timeoutSub.unsubscribe());

    return;
  }

  destroyClone(cloneRef, appRef);
  restoreOrigin();
};

export const abortFullscreenAnimation = <T, R>(
  context: OverlayStrategyContext<T, R>,
  state: FullscreenAnimationState,
  deps: FullscreenAnimationDeps,
): void => {
  const { renderer, appRef } = deps;

  unsubscribeAll(state);
  destroyClone(state.cloneComponentRef, appRef);

  cleanupFullscreenAnimationStyles(context.containerEl, renderer, state);
};
