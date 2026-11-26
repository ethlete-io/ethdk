import { ElementRef } from '@angular/core';
import { OverlayRef } from './overlay-ref';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const getClosestOverlay = (element: ElementRef<HTMLElement>, openOverlays: OverlayRef<unknown>[]) => {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('et-overlay')) {
    parent = parent.parentElement;
  }

  return parent ? openOverlays.find((overlay) => overlay.id === parent?.id) : null;
};
