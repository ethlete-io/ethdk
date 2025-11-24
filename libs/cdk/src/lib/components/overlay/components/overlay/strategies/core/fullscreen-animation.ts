import { ApplicationRef, ComponentRef, EnvironmentInjector, createComponent } from '@angular/core';
import { AngularRenderer, forceReflow, nextFrame } from '@ethlete/core';
import { Subscription, filter, take } from 'rxjs';
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

export type FullscreenAnimationCleanup = {
  originData: NonNullable<ReturnType<typeof getOriginCoordinatesAndDimensions>>;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  cloneComponentRef: ComponentRef<OverlayOriginCloneComponent>;
  contentAttachedSub: Subscription | null;
  animationStateSub: Subscription | null;
  leaveAnimationSub: Subscription | null;
  isEnterStarted: boolean;
  isEnterComplete: boolean;
  restoreOriginElement: () => void;
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

export const setupFullscreenEnterAnimation = <T, R>(params: {
  context: OverlayStrategyContext<T, R>;
  injector: EnvironmentInjector;
  document: Document;
  appRef: ApplicationRef;
  renderer: AngularRenderer;
  skipEnterAnimation?: boolean;
}): FullscreenAnimationCleanup => {
  const { context, injector, document, appRef, renderer, skipEnterAnimation = false } = params;
  const { containerEl, containerInstance, origin } = context;

  const originData = getOriginCoordinatesAndDimensions(origin);
  if (!originData) {
    throw new Error('Origin data is required for fullscreen animation');
  }

  const transforms = calculateViewportTransforms(originData.element);

  const originalOpacity = originData.element.style.opacity;
  const originalTransition = originData.element.style.transition;

  const cloneComponentRef = createComponent(OverlayOriginCloneComponent, {
    environmentInjector: injector,
  });

  const clonedContent = originData.element.cloneNode(true) as HTMLElement;
  const computedStyle = window.getComputedStyle(originData.element);

  renderer.setStyle(clonedContent, {
    margin: '0',
    position: 'relative',
    boxSizing: computedStyle.boxSizing,
    display: computedStyle.display,
  });

  cloneComponentRef.location.nativeElement.appendChild(clonedContent);

  const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

  applyCloneElementStyles(renderer, cloneEl, transforms.rect, transforms);
  applyContainerElementStyles(renderer, containerEl, transforms.rect, transforms);
  renderer.setStyle(containerEl, { transformOrigin: 'center center' });

  appRef.attachView(cloneComponentRef.hostView);
  document.body.appendChild(cloneEl);

  const restoreOriginElement = () => {
    renderer.setStyle(originData.element, {
      transition: 'none',
      opacity: originalOpacity || null,
    });

    forceReflow(originData.element);

    nextFrame(() => {
      renderer.setStyle(originData.element, {
        transition: originalTransition || null,
      });
    });
  };

  const cleanup: FullscreenAnimationCleanup = {
    originData,
    scaleX: transforms.scaleX,
    scaleY: transforms.scaleY,
    translateX: transforms.containerTranslateX,
    translateY: transforms.containerTranslateY,
    cloneComponentRef,
    contentAttachedSub: null,
    animationStateSub: null,
    leaveAnimationSub: null,
    isEnterStarted: skipEnterAnimation,
    isEnterComplete: skipEnterAnimation,
    restoreOriginElement,
  };

  if (skipEnterAnimation) {
    cloneComponentRef.instance.animatedLifecycle.forceEnteredState();

    renderer.setStyle(originData.element, {
      transition: 'none',
      opacity: '0',
    });
  } else {
    const contentAttachedSub = containerInstance.isContentAttached$
      .pipe(
        filter((a) => a),
        take(1),
      )
      .subscribe(() => {
        cleanup.isEnterStarted = true;

        forceReflow(cloneEl);

        nextFrame(() => {
          cloneComponentRef.instance.animatedLifecycle.enter();
          containerInstance.animatedLifecycle.enter();

          renderer.setStyle(originData.element, {
            transition: 'none',
            opacity: '0',
          });
        });
      });

    const animationStateSub = cloneComponentRef.instance.animatedLifecycle.state$
      .pipe(
        filter((state) => state === 'entered'),
        take(1),
      )
      .subscribe(() => {
        cleanup.isEnterComplete = true;
        contentAttachedSub.unsubscribe();
      });

    cleanup.contentAttachedSub = contentAttachedSub;
    cleanup.animationStateSub = animationStateSub;
  }

  return cleanup;
};
export const prepareFullscreenLeaveAnimation = (params: {
  cleanup: FullscreenAnimationCleanup;
  containerEl: HTMLElement;
  renderer: AngularRenderer;
}): void => {
  const { cleanup, containerEl, renderer } = params;
  const { cloneComponentRef, originData } = cleanup;

  const transforms = calculateViewportTransforms(originData.element);

  const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

  updateCloneLeaveAnimationStyles(renderer, cloneEl, transforms.rect, transforms);
  applyContainerElementStyles(renderer, containerEl, transforms.rect, transforms);

  const leaveSub = cloneComponentRef.instance.animatedLifecycle.state$
    .pipe(
      filter((state) => state === 'left'),
      take(1),
    )
    .subscribe();

  cleanup.leaveAnimationSub = leaveSub;
};
