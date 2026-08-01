import { afterNextRender, computed, Directive, ElementRef, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CHIP_ERROR_CODES } from './chip-errors';
import { ChipDirective } from './chip.directive';
import { injectChipLabels } from '../../chip/chip-labels';

@Directive({
  selector: '[etChipRemove]',
  exportAs: 'etChipRemove',
  host: {
    class: 'et-chip-remove',
    // chips are never tab stops - contexts like the select trigger or the tag input move
    // focus across chips virtually, and pointer/Backspace removal works without a tab stop
    tabindex: '-1',
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

  /** The string in effect: this instance's `removeLabel`, else the domain's label set. */
  public resolvedRemoveLabel = computed(() => this.removeLabel() ?? this.chipLabels().remove);

  protected readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.chip) {
          throw new RuntimeError(
            CHIP_ERROR_CODES.REMOVE_OUTSIDE_CHIP,
            '[ChipRemoveDirective] etChipRemove must be placed inside an [etChip] element.',
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
