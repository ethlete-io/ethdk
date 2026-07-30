import { arrow, autoUpdate, computePosition, flip, hide, limitShift, offset, shift, size } from '@floating-ui/dom';
import { AngularRenderer } from '../providers';
import { isHTMLElement } from './overlay-focus';
import { OverlayRuntimeRef } from './overlay-runtime-ref';
import {
  OverlayRuntimeAnchoredPosition,
  OverlayRuntimeCenteredPosition,
  OverlayRuntimeGlobalPosition,
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

export const applyGlobalPosition = (
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
  config: OverlayRuntimeGlobalPosition,
) => {
  renderer.setStyle(hostElement, {
    display: 'grid',
    // an explicit full-size cell keeps the grid area definite so percentage
    // based pane sizes (e.g. max-height: calc(100% - 72px)) can resolve
    gridTemplateRows: '100%',
    gridTemplateColumns: '100%',
    placeItems: `${config.vertical ?? 'center'} ${config.horizontal ?? 'center'}`,
    padding: config.padding ?? '0',
  });

  renderer.setStyle(paneElement, {
    position: 'relative',
  });
};

/**
 * Clears every inline style any position strategy kind may have set and
 * restores the base element styles, so a different strategy can be applied afterwards.
 */
export const resetPositioningStyles = (
  config: OverlayRuntimeMountConfig<object>,
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
) => {
  renderer.setStyle(hostElement, {
    gridTemplateRows: null,
    gridTemplateColumns: null,
    placeItems: null,
    padding: null,
    overflow: null,
  });

  renderer.setStyle(paneElement, {
    position: null,
    top: null,
    left: null,
    width: null,
    transform: null,
    visibility: null,
  });

  renderer.setCssProperties(paneElement, {
    '--et-overlay-max-width': null,
    '--et-overlay-max-height': null,
    '--et-overlay-anchored-x': null,
    '--et-overlay-anchored-y': null,
  });

  renderer.removeAttribute(paneElement, 'data-overlay-placement');

  setBaseElementStyles(config, hostElement, paneElement, renderer);
};

export const createAnchoredPositionCleanup = (
  strategy: OverlayRuntimeAnchoredPosition,
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  renderer: AngularRenderer,
) => {
  // mirrorWidth needs a real element to measure; virtual references fall back to max-content
  const mirrorWidthElement =
    strategy.mirrorWidth && isHTMLElement(strategy.referenceElement) ? strategy.referenceElement : null;

  renderer.setStyle(paneElement, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: mirrorWidthElement ? `${mirrorWidthElement.offsetWidth}px` : 'max-content',
  });

  const cleanup = autoUpdate(strategy.referenceElement, paneElement, () => {
    const arrowElement = paneElement.querySelector<HTMLElement>('[et-floating-arrow]');
    const middleware = [];

    middleware.push(offset(strategy.offset ?? 8));
    middleware.push(
      flip({
        fallbackPlacements: strategy.fallbackPlacements ?? undefined,
        fallbackAxisSideDirection: 'start',
        boundary: strategy.boundary,
      }),
    );

    if (strategy.shift !== false) {
      middleware.push(
        shift({
          crossAxis: typeof strategy.shift === 'object' ? (strategy.shift.crossAxis ?? false) : false,
          limiter: limitShift(),
          padding: strategy.viewportPadding ?? 8,
          boundary: strategy.boundary,
        }),
      );
    }

    // size must run AFTER shift so the available space is measured from the shifted position —
    // otherwise a cross-axis-shifted pane gets its max size capped to the unshifted leftover space
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

    if (arrowElement) {
      middleware.push(
        arrow({
          element: arrowElement,
          // keeps the arrow off a rounded pane corner by default: 12px covers the radius of the
          // built-in boxed panes (--et-overlay-radius). Panes with a larger radius have to pass their
          // own — an arrow whose base sits on the corner arc looks detached from the pane.
          padding: strategy.arrowPadding ?? 12,
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
      // A detached reference reports a zeroed rect, so floating-ui positions the pane at the
      // viewport's top-left. Tear the overlay down (without animating from that bogus position)
      // before applying the transform when auto-close is on, and otherwise leave the pane where it
      // last was rather than snapping it to the corner.
      if (middlewareData.hide?.referenceHidden) {
        if (strategy.autoCloseIfReferenceHidden) {
          overlayRef.close(undefined, 'reference-detached');
          return;
        }

        if (strategy.autoHide) {
          renderer.setStyle(paneElement, { visibility: 'hidden' });
        }
        return;
      }

      renderer.setStyle(paneElement, {
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width: mirrorWidthElement ? `${mirrorWidthElement.offsetWidth}px` : null,
        visibility: null,
      });
      // exposed so animations can compose their transforms with the anchored position
      renderer.setCssProperties(paneElement, {
        '--et-overlay-anchored-x': `${x}px`,
        '--et-overlay-anchored-y': `${y}px`,
      });
      renderer.setAttribute(paneElement, 'data-overlay-placement', placement);

      if (arrowElement && middlewareData.arrow) {
        renderer.setCssProperty(
          arrowElement,
          '--et-floating-arrow-translate',
          `translate3d(${middlewareData.arrow.x ?? 0}px, ${middlewareData.arrow.y ?? 0}px, 0)`,
        );
      }
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

  if (strategy.kind === 'global') {
    applyGlobalPosition(hostElement, paneElement, renderer, strategy);

    return () => undefined;
  }

  applyCenteredPosition(hostElement, paneElement, renderer, strategy);

  return () => undefined;
};
