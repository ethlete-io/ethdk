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
 * on theirs. Without a registered viewport, `virtualizedItems()` falls back to every
 * visible option (no windowing).
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

  // a panel that does not mirror the field takes its width from the rendered rows, and windowing
  // only ever renders the rows around the scroll offset - so the panel would resize on every
  // scroll, as long labels enter and leave the window
  private locksWidth = computed(() => {
    const select = this.select;

    return !!select?.windowsOptions() && !select.mirrorPanelWidth();
  });

  private widthFloor = linkedSignal<string, number>({
    // a new query is a new set of rows - the panel may size down to fit them again
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
