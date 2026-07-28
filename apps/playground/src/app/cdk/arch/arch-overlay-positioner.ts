// Extracted from arch.component.ts: an interpolated template literal above an inline `template:`
// desynchronises the Angular VS Code extension's editor-side scanner, which then stops forwarding
// template completions to the language service — see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

import { DestroyRef, inject } from '@angular/core';
import {
  Placement,
  arrow,
  autoUpdate,
  computePosition,
  flip,
  hide,
  limitShift,
  offset,
  shift,
  size,
} from '@floating-ui/dom';

export type CreateOverlayPositionerOptions = {
  /** The element the overlay should get attached to */
  referenceElement: HTMLElement;

  /** The overlay to position */
  overlayElement: HTMLElement;

  viewportPadding?: number;

  placement?: Placement;

  offset?: number;

  boundary?: HTMLElement;

  fallbackPlacements?: Placement[];

  autoResize?: boolean;

  autoHide?: boolean;

  shift?: boolean;

  arrow?: {
    element: HTMLElement;
    padding?: number;
  };
};

export const createOverlayPositioner = () => {
  let cleanupFn: (() => void) | null = null;
  const ACTIVE_CLASS = 'et-uses-overlay-positioner';

  const attach = (options: CreateOverlayPositionerOptions) => {
    const { referenceElement, overlayElement } = options;

    overlayElement.classList.add(ACTIVE_CLASS);

    cleanupFn = autoUpdate(referenceElement, overlayElement, () => {
      computePosition(referenceElement, overlayElement, {
        placement: options.placement,
        middleware: [
          ...(options.offset ? [offset(options.offset)] : []),
          flip({
            fallbackPlacements: options.fallbackPlacements ?? undefined,
            fallbackAxisSideDirection: 'start',
            boundary: options.boundary,
          }),
          ...(options.autoResize
            ? [
                size({
                  padding: options.viewportPadding ?? undefined,
                  apply({ availableHeight, availableWidth }) {
                    overlayElement.style.setProperty('--et-floating-max-width', `${availableWidth}px`);
                    overlayElement.style.setProperty('--et-floating-max-height', `${availableHeight}px`);
                  },
                }),
              ]
            : []),
          ...(options.shift
            ? [
                shift({
                  limiter: limitShift(),
                  padding: options.viewportPadding ?? undefined,
                  boundary: options.boundary,
                }),
              ]
            : []),
          ...(options.arrow?.element
            ? [arrow({ element: options.arrow.element, padding: options.arrow.padding ?? undefined })]
            : []),
          ...(options.autoHide ? [hide({ strategy: 'referenceHidden', boundary: options.boundary })] : []),
        ],
      }).then(({ x, y, placement, middlewareData }) => {
        overlayElement.style.setProperty('--et-floating-translate', `translate3d(${x}px, ${y}px, 0)`);
        overlayElement.setAttribute('et-floating-placement', placement);

        if (middlewareData.arrow && options.arrow?.element) {
          const { x: arrowX, y: arrowY } = middlewareData.arrow;

          overlayElement.style.setProperty(
            '--et-floating-arrow-translate',
            `translate3d(${arrowX ?? 0}px, ${arrowY ?? 0}px, 0)`,
          );
        }

        if (middlewareData.hide?.referenceHidden) {
          overlayElement.classList.add('et-floating-element--hidden');
        } else {
          overlayElement.classList.remove('et-floating-element--hidden');
        }
      });
    });
  };

  const detach = () => {
    cleanupFn?.();
    cleanupFn = null;
  };

  inject(DestroyRef).onDestroy(() => detach());

  return { attach, detach };
};
