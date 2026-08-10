import { isDevMode } from '@angular/core';
import {
  autoUpdate,
  computePosition,
  flip,
  limitShift,
  Middleware,
  offset,
  Padding,
  Placement,
  shift,
} from '@floating-ui/dom';
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

type AnchoredSide = 'top' | 'bottom' | 'left' | 'right';

const OPPOSITE_SIDE: Record<AnchoredSide, AnchoredSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const PREFERRED_SIDE_NAME = 'etPreferredSide';

type PreferredSideData = { availableSpace?: Partial<Record<AnchoredSide, number>> };

const getAnchoredSide = (placement: Placement) => placement.split('-')[0] as AnchoredSide;

const toOppositeSidePlacement = (placement: Placement) => {
  const [side, alignment] = placement.split('-') as [AnchoredSide, string | undefined];
  const opposite = OPPOSITE_SIDE[side];

  return (alignment ? `${opposite}-${alignment}` : opposite) as Placement;
};

/**
 * The `flip` replacement behind `minAvailableSpace` - see that option. Every decision here has to
 * stay derived from the space around the reference alone: the moment the pane's own size enters it,
 * `size`'s cap feeds back into the next placement and an open pane starts flipping on its own.
 */
const preferredSide = (options: {
  minAvailableSpace: number;
  padding: Padding;
  boundary: Element | Element[] | undefined;
}): Middleware => ({
  name: PREFERRED_SIDE_NAME,
  options,
  async fn(state) {
    const { placement, initialPlacement, rects, middlewareData } = state;
    const side = getAnchoredSide(placement);
    // via the platform, like every built-in middleware - importing `detectOverflow` from
    // `@floating-ui/dom` instead pulls a second copy of it into the bundle
    const overflow = await state.platform.detectOverflow(state, {
      padding: options.padding,
      boundary: options.boundary,
    });
    const isYAxis = side === 'top' || side === 'bottom';
    // the pane's own size cancels out of `size - overflow[side]`: what remains is the distance from
    // its anchored edge to the boundary - the same number the `size` middleware caps the pane to
    const available = (isYAxis ? rects.floating.height : rects.floating.width) - overflow[side];
    const availableSpace: Partial<Record<AnchoredSide, number>> = {
      ...(middlewareData[PREFERRED_SIDE_NAME] as PreferredSideData | undefined)?.availableSpace,
      [side]: available,
    };

    if (available >= options.minAvailableSpace) {
      return {};
    }

    const oppositeAvailable = availableSpace[OPPOSITE_SIDE[side]];

    if (oppositeAvailable === undefined) {
      return { data: { availableSpace }, reset: { placement: toOppositeSidePlacement(placement) } };
    }

    // ties go to the placement's own side, which also terminates the reset loop after at most one
    // measurement per side
    const keepSide =
      side === getAnchoredSide(initialPlacement) ? available >= oppositeAvailable : available > oppositeAvailable;

    return keepSide
      ? { data: { availableSpace } }
      : { data: { availableSpace }, reset: { placement: toOppositeSidePlacement(placement) } };
  },
});

export const createAnchoredPositionCleanup = (
  strategy: OverlayRuntimeAnchoredPosition,
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  renderer: AngularRenderer,
) => {
  // mirrorWidth needs a real element to measure; virtual references fall back to max-content
  const mirrorWidthElement =
    strategy.mirrorWidth && isHTMLElement(strategy.referenceElement) ? strategy.referenceElement : null;

  if (strategy.minAvailableSpace !== undefined && !strategy.autoResize && isDevMode()) {
    console.error(
      'An anchored overlay sets `minAvailableSpace` without `autoResize`, so it is kept on a side it does not fit on with nothing capping it to the space there. Enable `autoResize` or drop `minAvailableSpace`.',
    );
  }

  renderer.setStyle(paneElement, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: mirrorWidthElement ? `${mirrorWidthElement.offsetWidth}px` : 'max-content',
  });

  /**
   * What to do when the reference is not somewhere the pane can be positioned against: either removed
   * from the document, or scrolled out of a clipping ancestor. Both measure as a rect the pane must not
   * be moved to - a detached element reports zeros, which is the viewport's top-left corner.
   */
  const handleUnusableReference = () => {
    if (strategy.autoCloseIfReferenceHidden) {
      // Closed before any transform is applied, so the exit animation does not run from the corner.
      overlayRef.close(undefined, 'reference-detached');

      return;
    }

    if (strategy.autoHide) {
      renderer.setStyle(paneElement, { visibility: 'hidden' });
    }
  };

  const cleanup = autoUpdate(strategy.referenceElement, paneElement, () => {
    // Checked here rather than left to the `hide` middleware, which is only in the list when `autoHide`
    // or `autoCloseIfReferenceHidden` asked for it: a trigger destroyed while its overlay is open (a
    // menu item that removes the button it was opened from) would otherwise fly to the corner for the
    // frames the overlay takes to animate out.
    if (isHTMLElement(strategy.referenceElement) && !strategy.referenceElement.isConnected) {
      handleUnusableReference();

      return;
    }

    const arrowElement = paneElement.querySelector<HTMLElement>('[et-floating-arrow]');
    const middleware = [];

    middleware.push(offset(strategy.offset ?? 8));
    middleware.push(
      strategy.minAvailableSpace === undefined
        ? flip({
            fallbackPlacements: strategy.fallbackPlacements ?? undefined,
            fallbackAxisSideDirection: 'start',
            boundary: strategy.boundary,
          })
        : preferredSide({
            minAvailableSpace: strategy.minAvailableSpace,
            // must stay the padding `size` measures with: the threshold is then compared against the
            // very height the pane ends up capped to
            padding: strategy.viewportPadding ?? 8,
            boundary: strategy.boundary,
          }),
    );

    if (strategy.shift !== false) {
      middleware.push(
        shift({
          // floating-ui's cross axis points at the reference, so shifting on it slides the pane over
          // the reference instead of letting it shrink - and `size` then reports the whole boundary
          // as available height rather than the space on the pane's side
          crossAxis:
            strategy.minAvailableSpace === undefined &&
            (typeof strategy.shift === 'object' ? (strategy.shift.crossAxis ?? false) : false),
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
      if (middlewareData.hide?.referenceHidden) {
        handleUnusableReference();

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
