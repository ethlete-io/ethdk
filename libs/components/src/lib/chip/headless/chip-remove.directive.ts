import { afterNextRender, computed, Directive, ElementRef, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CHIP_ERROR_CODES } from './chip-errors';
import { CHIP_REMOVE_TAB_STOP } from './chip.tokens';
import { ChipDirective } from './chip.directive';
import { injectChipLabels } from '../../chip/chip-labels';

@Directive({
  selector: '[etChipRemove]',
  exportAs: 'etChipRemove',
  host: {
    class: 'et-chip-remove',
    '[attr.tabindex]': 'tabIndex()',
    '[attr.type]': 'IS_BUTTON ? "button" : null',
    '[attr.disabled]': 'IS_BUTTON && chip?.disabled() ? "" : null',
    '[attr.aria-label]': 'resolvedRemoveLabel()',
    '(click)': 'handleClick($event)',
  },
})
export class ChipRemoveDirective {
  private chipLabels = injectChipLabels();

  protected chip = inject(ChipDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public removeLabel = input<string | null>(null);
  private isTabStop = inject(CHIP_REMOVE_TAB_STOP, { optional: true }) ?? true;

  protected readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';

  /** The string in effect: this instance's `removeLabel`, else the domain's label set. */
  public resolvedRemoveLabel = computed(() => this.removeLabel() ?? this.chipLabels().remove);

  /** `null` leaves a `<button>` in its natural tab order; any other host needs an explicit value. */
  public tabIndex = computed(() => {
    if (!this.isTabStop || this.chip?.disabled() || !this.chip?.removable()) {
      return '-1';
    }

    return this.IS_BUTTON ? null : '0';
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.chip) {
          throw new RuntimeError(
            CHIP_ERROR_CODES.REMOVE_OUTSIDE_CHIP,
            '[ChipRemoveDirective] etChipRemove must be placed inside an [etChip] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected handleClick(event: Event) {
    // a chip may itself be clickable (e.g. filter chips) - removal must not double as activation
    event.stopPropagation();
    this.chip?.requestRemove();
  }
}
