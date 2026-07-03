import { ElementRef } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { OverlayRef } from './overlay-ref';

export const getClosestOverlay = (element: ElementRef<HTMLElement>, openOverlays: OverlayRef<object, unknown>[]) => {
  const nativeElement = element.nativeElement;

  return openOverlays.find((overlay) => overlay.elements?.paneElement.contains(nativeElement)) ?? null;
};

export type ResolveClosestOverlayOptions = {
  overlayRef: OverlayRef<object, unknown> | null;
  element: ElementRef<HTMLElement>;
  openOverlays: OverlayRef<object, unknown>[];
};

/** Returns the given ref or resolves the overlay the element is rendered inside of. Throws if neither exists. */
export const resolveClosestOverlay = (options: ResolveClosestOverlayOptions): OverlayRef<object, unknown> => {
  const { overlayRef, element, openOverlays } = options;
  const resolved = overlayRef ?? getClosestOverlay(element, openOverlays);

  if (!resolved) {
    throw new RuntimeError(
      OVERLAY_ERROR_CODES.NO_CLOSEST_OVERLAY,
      '[Overlay] No overlay found. The element must be rendered inside an open overlay.',
    );
  }

  return resolved;
};
