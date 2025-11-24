import { ElementRef } from '@angular/core';
import { OverlayRef } from './overlay-ref';

export const getClosestOverlay = (element: ElementRef<HTMLElement>, openOverlays: OverlayRef<unknown>[]) => {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('et-overlay')) {
    parent = parent.parentElement;
  }

  return parent ? openOverlays.find((overlay) => overlay.id === parent?.id) : null;
};
