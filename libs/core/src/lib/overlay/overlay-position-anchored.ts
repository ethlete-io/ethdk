import { isDevMode } from '@angular/core';
import { autoUpdate, computePosition, flip, limitShift, offset, shift } from '@floating-ui/dom';
import { AngularRenderer } from '../providers';
import { isHTMLElement } from './overlay-focus';
import { registerAnchoredPositionSetup } from './overlay-position';
import { OverlayRuntimeRef } from './overlay-runtime-ref';
import { OverlayRuntimeAnchoredPosition } from './overlay-runtime.types';

/**
 * The floating-ui middleware only a subset of anchored overlays needs. Installed by
 * `enableAnchoredOverlayPositionExtras()`.
 *
 * @internal
 */
export type AnchoredPositionMiddlewareExtras = {
  size: typeof import('@floating-ui/dom').size;
  arrow: typeof import('@floating-ui/dom').arrow;
  hide: typeof import('@floating-ui/dom').hide;
};

let middlewareExtras: AnchoredPositionMiddlewareExtras | null = null;

/**
 * Installs the `size` / `arrow` / `hide` middleware. Called by
 * `enableAnchoredOverlayPositionExtras()`.
 *
 * @internal
 */
export const registerAnchoredPositionMiddlewareExtras = (extras: AnchoredPositionMiddlewareExtras) => {
  middlewareExtras = extras;
};

const requireMiddlewareExtras = (feature: string) => {
  if (!middlewareExtras && isDevMode()) {
    console.error(
      `An anchored overlay uses "${feature}", but the matching floating-ui middleware is not installed. Call \`enableAnchoredOverlayPositionExtras()\` from @ethlete/core once during app setup.`,
    );
  }

  return middlewareExtras;
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

    // size must run AFTER shift so the available space is measured from the shifted position -
    // otherwise a cross-axis-shifted pane gets its max size capped to the unshifted leftover space
    if (strategy.autoResize) {
      const extras = requireMiddlewareExtras('autoResize');

      if (extras) {
        middleware.push(
          extras.size({
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
    }

    if (arrowElement) {
      const extras = requireMiddlewareExtras('arrow');

      if (extras) {
        middleware.push(
          extras.arrow({
            element: arrowElement,
            // keeps the arrow off a rounded pane corner by default: 12px covers the radius of the
            // built-in boxed panes (--et-overlay-radius). Panes with a larger radius have to pass their
            // own - an arrow whose base sits on the corner arc looks detached from the pane.
            padding: strategy.arrowPadding ?? 12,
          }),
        );
      }
    }

    if (strategy.autoHide || strategy.autoCloseIfReferenceHidden) {
      const extras = requireMiddlewareExtras('autoHide');

      if (extras) {
        middleware.push(
          extras.hide({
            strategy: 'referenceHidden',
          }),
        );
      }
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

/**
 * Builds an anchored position strategy and installs the anchored positioning implementation.
 *
 * Anchored positioning is the only part of the overlay runtime that needs `@floating-ui/dom`, and it
 * is reachable only through this function - an app that positions its overlays centered or globally
 * never bundles it. Always build anchored strategies with this helper instead of a plain
 * `{ kind: 'anchored', ... }` literal.
 *
 * Overlays that set `autoResize`, `autoHide`, `autoCloseIfReferenceHidden` or render an arrow
 * additionally need `enableAnchoredOverlayPositionExtras()`.
 */
export const anchoredOverlayPosition = (
  config: Omit<OverlayRuntimeAnchoredPosition, 'kind'>,
): OverlayRuntimeAnchoredPosition => {
  registerAnchoredPositionSetup(createAnchoredPositionCleanup);

  return { kind: 'anchored', ...config };
};
