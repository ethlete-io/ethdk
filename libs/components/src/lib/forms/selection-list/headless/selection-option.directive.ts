import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { SELECTION_LIST_TOKEN } from './selection-list.tokens';

let uniqueOptionLabelId = 0;

@Directive({
  selector: '[etSelectionOption]',
  host: {
    '[attr.role]': 'role()',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-selected]': 'checked()',
    '[attr.aria-disabled]': 'effectiveDisabled() || null',
    '[attr.tabindex]': 'tabindex()',
    '(click)': 'select()',
    '(keydown.space)': 'select(); $event.preventDefault()',
    '(keydown.enter)': 'select(); $event.preventDefault()',
    '(keydown.ArrowDown)': 'focusNext($event)',
    '(keydown.ArrowRight)': 'focusNext($event)',
    '(keydown.ArrowUp)': 'focusPrevious($event)',
    '(keydown.ArrowLeft)': 'focusPrevious($event)',
    '(blur)': 'markTouched()',
  },
})
export class SelectionOptionDirective {
  private list = inject(SELECTION_LIST_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  public value = input.required<unknown>();
  public checked = model(false);
  public disabled = input(false);

  public effectiveDisabled = computed(() => this.disabled() || (this.list?.disabled() ?? false));
  public role = computed(() => (this.list?.multiple() ? 'option' : 'radio'));

  public labelId = signal(`et-selection-option-label-${uniqueOptionLabelId++}`);

  private listItem = {
    value: this.value,
    checked: this.checked,
    disabled: this.effectiveDisabled,
    elementRef: this.el,
  };

  public tabindex = computed(() => {
    if (this.effectiveDisabled()) {
      return -1;
    }

    if (!this.list) {
      return 0;
    }

    const items = this.list.items();
    const checkedItem = items.find((i) => i.checked());

    if (checkedItem) {
      return checkedItem === this.listItem ? 0 : -1;
    }

    return items[0] === this.listItem ? 0 : -1;
  });

  constructor() {
    if (this.list) {
      const list = this.list;
      list.registerItem(this.listItem);
      this.destroyRef.onDestroy(() => list.unregisterItem(this.listItem));
    }
  }

  public select() {
    if (this.effectiveDisabled()) {
      return;
    }

    if (this.list) {
      this.list.select(this.listItem);
    } else {
      this.checked.update((v) => !v);
    }
  }

  public markTouched() {
    if (this.list) {
      this.list.markTouched();
    }
  }

  public focusNext(event: Event) {
    event.preventDefault();

    if (!this.list || this.effectiveDisabled()) {
      return;
    }

    const items = this.list.items();
    const currentIndex = items.indexOf(this.listItem);
    let nextIndex = (currentIndex + 1) % items.length;

    while (items[nextIndex]?.disabled() && nextIndex !== currentIndex) {
      nextIndex = (nextIndex + 1) % items.length;
    }

    const nextItem = items[nextIndex];

    if (nextItem && !nextItem.disabled()) {
      if (!this.list.multiple()) {
        this.list.select(nextItem);
      }

      this.list.focusItem(nextItem);
    }
  }

  public focusPrevious(event: Event) {
    event.preventDefault();

    if (!this.list || this.effectiveDisabled()) {
      return;
    }

    const items = this.list.items();
    const currentIndex = items.indexOf(this.listItem);
    let prevIndex = (currentIndex - 1 + items.length) % items.length;

    while (items[prevIndex]?.disabled() && prevIndex !== currentIndex) {
      prevIndex = (prevIndex - 1 + items.length) % items.length;
    }

    const prevItem = items[prevIndex];

    if (prevItem && !prevItem.disabled()) {
      if (!this.list.multiple()) {
        this.list.select(prevItem);
      }

      this.list.focusItem(prevItem);
    }
  }
}
