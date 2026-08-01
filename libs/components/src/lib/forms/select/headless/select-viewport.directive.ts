import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

/**
 * Marks the scrollable element that data-driven (`options` input) rendering windows
 * against. `et-select-panel` applies it to its own scroller - headless consumers put it
 * on theirs. Without a registered viewport, `virtualizedItems()` falls back to every
 * visible option (no windowing).
 */
@Directive({
  selector: '[etSelectViewport]',
  exportAs: 'etSelectViewport',
})
export class SelectViewportDirective {
  private select = inject(SelectDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    registerSingleton(this.select?.registeredViewport, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.VIEWPORT_OUTSIDE_SELECT,
            '[SelectViewportDirective] etSelectViewport must be rendered inside the surface of an [etSelect] element.',
          );
        }
      });
    }
  }
}
