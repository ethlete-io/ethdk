import { Directive, booleanAttribute, input, output } from '@angular/core';

@Directive({
  selector: '[etChip]',
  exportAs: 'etChip',
  host: {
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-removable]': 'removable() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '(keydown.backspace)': 'handleRemoveKey($event)',
    '(keydown.delete)': 'handleRemoveKey($event)',
  },
})
export class ChipDirective {
  public disabled = input(false, { transform: booleanAttribute });
  public removable = input(false, { transform: booleanAttribute });
  public remove = output<void>();

  public requestRemove() {
    if (this.disabled() || !this.removable()) {
      return;
    }

    this.remove.emit();
  }

  protected handleRemoveKey(event: Event) {
    if (this.disabled() || !this.removable()) {
      return;
    }

    event.preventDefault();
    this.remove.emit();
  }
}
