import { ElementRef } from '@angular/core';
import { OVERLAY_DEFAULT_OPTIONS } from '../constants';
import { OverlayConfig } from '../types';
import { createOverlayConfig } from './overlay-config';
import { OverlayRef } from './overlay-ref';

export function getClosestOverlay(element: ElementRef<HTMLElement>, openOverlays: OverlayRef<unknown>[]) {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('et-overlay')) {
    parent = parent.parentElement;
  }

  return parent ? openOverlays.find((overlay) => overlay.id === parent?.id) : null;
}

export const provideOverlayDefaultConfig = (config: Partial<OverlayConfig> | null | undefined = {}) => {
  return { provide: OVERLAY_DEFAULT_OPTIONS, useValue: createOverlayConfig(config) };
};
