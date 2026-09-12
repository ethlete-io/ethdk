import {
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { RuntimeError, signalElementDimensions } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

/**
 * Marks the scrollable element that data-driven (`options` input) rendering windows
 * against. `et-select-panel` applies it to its own scroller - headless consumers put it
 * on theirs.
 */
@Directive({
  selector: '[etSelectViewport]',
  exportAs: 'etSelectViewport',
  host: {
    '[style.min-inline-size.px]': 'minInlineSize()',
  },
})
export class SelectViewportDirective {
  private select = inject(SelectDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private dimensions = signalElementDimensions(this.elementRef);

  private locksWidth = computed(() => {
    const select = this.select;

    return !!select?.windowsOptions() && !select.mirrorPanelWidth();
  });

  private widthFloor = linkedSignal<string, number>({
    source: () => this.select?.panelFilterQuery() ?? '',
    computation: () => 0,
  });

  protected minInlineSize = computed(() => (this.locksWidth() ? this.widthFloor() || null : null));

  constructor() {
    registerSingleton(this.select?.registeredViewport, this);

    effect(() => {
      if (!this.locksWidth()) {
        return;
      }

      const width = this.dimensions().offset?.width ?? 0;

      if (width > untracked(this.widthFloor)) {
        this.widthFloor.set(width);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.VIEWPORT_OUTSIDE_SELECT,
            '[SelectViewportDirective] etSelectViewport must be rendered inside the surface of an [etSelect] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
