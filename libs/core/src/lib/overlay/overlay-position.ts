import { arrow, autoUpdate, computePosition, flip, hide, limitShift, offset, shift, size } from '@floating-ui/dom';
import { AngularRenderer } from '../providers';
import { OverlayRuntimeRef } from './overlay-runtime-ref';
import {
  OverlayRuntimeAnchoredPosition,
  OverlayRuntimeCenteredPosition,
  OverlayRuntimeMountConfig,
} from './overlay-runtime.types';

export const setBaseElementStyles = (
  config: OverlayRuntimeMountConfig<object>,
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
) => {
  renderer.setStyle(hostElement, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    display: 'block',
    pointerEvents: config.hasBackdrop === false ? 'none' : 'auto',
  });

  renderer.setStyle(paneElement, {
    pointerEvents: 'auto',
    outline: 'none',
  });
};

export const setBackdropStyles = (backdropElement: HTMLElement, renderer: AngularRenderer) => {
  renderer.setStyle(backdropElement, {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
  });
};

export const applyCenteredPosition = (
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
  _config: OverlayRuntimeCenteredPosition,
) => {
  renderer.setStyle(hostElement, {
    display: 'grid',
    placeItems: 'center',
    padding: '16px',
    overflow: 'auto',
  });

  renderer.setStyle(paneElement, {
    position: 'relative',
  });
};

export const createAnchoredPositionCleanup = (
  strategy: OverlayRuntimeAnchoredPosition,
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  renderer: AngularRenderer,
) => {
  const arrowElement = paneElement.querySelector<HTMLElement>('[et-floating-arrow]');

  renderer.setStyle(paneElement, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: strategy.mirrorWidth ? `${strategy.referenceElement.offsetWidth}px` : 'max-content',
  });

  const cleanup = autoUpdate(strategy.referenceElement, paneElement, () => {
    const middleware = [];

    middleware.push(offset(strategy.offset ?? 8));
    middleware.push(
      flip({
        fallbackPlacements: strategy.fallbackPlacements ?? undefined,
        fallbackAxisSideDirection: 'start',
      }),
    );

    if (strategy.autoResize) {
      middleware.push(
        size({
          padding: strategy.viewportPadding ?? 8,
          apply({ availableHeight, availableWidth }) {
            renderer.setCssProperties(paneElement, {
              '--et-overlay-max-width': `${availableWidth}px`,
              '--et-overlay-max-height': `${availableHeight}px`,
            });
          },
        }),
      );
    }

    if (strategy.shift !== false) {
      middleware.push(
        shift({
          limiter: limitShift(),
          padding: strategy.viewportPadding ?? 8,
        }),
      );
    }

    if (arrowElement) {
      middleware.push(
        arrow({
          element: arrowElement,
          padding: strategy.arrowPadding ?? 4,
        }),
      );
    }

    if (strategy.autoHide || strategy.autoCloseIfReferenceHidden) {
      middleware.push(
        hide({
          strategy: 'referenceHidden',
        }),
      );
    }

    computePosition(strategy.referenceElement, paneElement, {
      placement: strategy.placement ?? 'bottom',
      strategy: 'absolute',
      middleware,
    }).then(({ x, y, placement, middlewareData }) => {
      renderer.setStyle(paneElement, {
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width: strategy.mirrorWidth ? `${strategy.referenceElement.offsetWidth}px` : null,
      });
      renderer.setAttribute(paneElement, 'data-overlay-placement', placement);

      if (arrowElement && middlewareData.arrow) {
        renderer.setCssProperty(
          arrowElement,
          '--et-floating-arrow-translate',
          `translate3d(${middlewareData.arrow.x ?? 0}px, ${middlewareData.arrow.y ?? 0}px, 0)`,
        );
      }

      if (middlewareData.hide?.referenceHidden) {
        if (strategy.autoCloseIfReferenceHidden) {
          overlayRef.close(undefined, 'api');
          return;
        }

        renderer.setStyle(paneElement, {
          visibility: strategy.autoHide ? 'hidden' : null,
        });
        return;
      }

      renderer.setStyle(paneElement, {
        visibility: null,
      });
    });
  });

  return () => {
    cleanup();
  };
};

export const setupPositioning = (
  config: OverlayRuntimeMountConfig<object>,
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  renderer: AngularRenderer,
) => {
  const strategy = config.positionStrategy ?? { kind: 'center' };

  if (strategy.kind === 'anchored') {
    renderer.setStyle(hostElement, {
      pointerEvents: config.hasBackdrop === false ? 'none' : 'auto',
    });

    return createAnchoredPositionCleanup(strategy, paneElement, overlayRef, renderer);
  }

  applyCenteredPosition(hostElement, paneElement, renderer, strategy);

  return () => undefined;
};
