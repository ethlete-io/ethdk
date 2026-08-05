import { Directive, afterNextRender, computed, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { FILTER_OVERLAY_ERROR_CODES } from '../filter-overlay-errors';
import { FILTER_OVERLAY_TOKEN } from '../filter-overlay';

/** Dev-mode guard: a control with no filter overlay above it has nothing to submit or reset. */
const assertInsideFilterOverlay = (hasOverlay: boolean, directiveName: string) => {
  if (!ngDevMode) return;

  const element = injectHostElement();

  afterNextRender(() => {
    if (!hasOverlay) {
      throw new RuntimeError(
        FILTER_OVERLAY_ERROR_CODES.MISSING_FILTER_OVERLAY,
        `[${directiveName}] No filter overlay was found. Add provideFilterOverlay({ … }) to the providers of the ` +
          'overlay component this control lives in.',
        { element },
      );
    }
  });
};

/**
 * The submit button. Takes its label and disabled state from the live preview, so the button reads "Show 42
 * results" rather than "Apply" and disables itself while the count is pending or zero.
 *
 * Put it on a real `<button>` - it is the primary action of a form and should behave like one.
 *
 * @example
 * <button etFilterOverlaySubmit et-button></button>
 */
@Directive({
  selector: 'button[etFilterOverlaySubmit]',
  exportAs: 'etFilterOverlaySubmit',
  host: {
    class: 'et-filter-overlay-submit',
    type: 'button',
    '[disabled]': 'isDisabled()',
    '(click)': 'filterOverlay?.submit()',
  },
})
export class FilterOverlaySubmitDirective {
  protected filterOverlay = inject(FILTER_OVERLAY_TOKEN, { optional: true });

  protected isDisabled = computed(() => this.filterOverlay?.submitButton().disabled ?? true);

  /** The label the button should show. Rendered by `<et-filter-overlay-submit-label>`, or read it yourself. */
  public label = computed(() => this.filterOverlay?.submitButton().label ?? '');

  constructor() {
    assertInsideFilterOverlay(!!this.filterOverlay, 'FilterOverlaySubmitDirective');
  }
}

/**
 * The reset control: puts every filter in the draft back to its default without closing the overlay, so the
 * reader can start again without losing the panel.
 *
 * @example
 * <button etFilterOverlayReset et-button variant="transparent">Reset</button>
 */
@Directive({
  selector: 'button[etFilterOverlayReset]',
  exportAs: 'etFilterOverlayReset',
  host: {
    class: 'et-filter-overlay-reset',
    type: 'button',
    '[disabled]': 'isDisabled()',
    '(click)': 'filterOverlay?.reset()',
  },
})
export class FilterOverlayResetDirective {
  protected filterOverlay = inject(FILTER_OVERLAY_TOKEN, { optional: true });

  /**
   * Nothing to reset when every field is already at its default. Deliberately not `activeFilterCount() === 0`:
   * the query form leaves search and pagination out of that count, so a typed search would otherwise leave the
   * reset button disabled with something still to clear.
   */
  protected isDisabled = computed(() => this.filterOverlay?.isPristine() ?? true);

  constructor() {
    assertInsideFilterOverlay(!!this.filterOverlay, 'FilterOverlayResetDirective');
  }
}
