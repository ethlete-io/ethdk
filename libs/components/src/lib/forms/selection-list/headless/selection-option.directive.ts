import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { SELECTION_LIST_TOKEN } from './selection-list.tokens';

let uniqueOptionLabelId = 0;

/**
 * Placeholder an option's value resolves to while its required `value` input has not been
 * bound yet (e.g. a directive-composed option whose bindings run after registration, like
 * the filter-chip composition). Never matches a consumer value, so unbound options simply
 * cannot be selected until their bindings run - mirrors the select option.
 */
const UNBOUND_VALUE = /* @__PURE__ */ Symbol('et-selection-option-unbound');

@Directive({
  selector: '[etSelectionOption]',
  host: {
    '[attr.role]': 'role()',
    '[attr.aria-checked]': 'checked()',
    // name from the label span only - a projected <et-description> lives in the host too, so
    // relying on name-from-contents would fold the description into the accessible name
    '[attr.aria-labelledby]': 'labelId()',
    '[attr.aria-disabled]': 'effectiveDisabled() || null',
    // only in multi mode: role=checkbox supports aria-readonly, role=radio does not - the
    // single-select case reflects it on the radiogroup host instead
    '[attr.aria-readonly]': '(role() === "checkbox" && effectiveReadonly()) || null',
    '[attr.data-readonly]': 'effectiveReadonly() || null',
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
  public disabled = input(false, { transform: booleanAttribute });

  public effectiveDisabled = computed(() => this.disabled() || (this.list?.disabled() ?? false));
  public effectiveReadonly = computed(() => this.list?.readonly() ?? false);
  // multi-select lives in a `role="group"`, where `option` is invalid ARIA (it's listbox-only) -
  // a checkbox pairs correctly with `group` + `aria-checked`; single-select stays a radio.
  public role = computed(() => (this.list?.multiple() ? 'checkbox' : 'radio'));

  public labelId = signal(`et-selection-option-label-${uniqueOptionLabelId++}`);

  // reading through this computed keeps registry-wide reads (value↔checked sync) crash-free
  // while the required `value` input has not executed its binding yet
  private boundValue = computed(() => {
    try {
      return this.value();
    } catch {
      return UNBOUND_VALUE;
    }
  });

  private listItem = {
    value: this.boundValue,
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

    const items = this.list.selection.items();
    const checkedItem = items.find((i) => i.checked());

    if (checkedItem) {
      return checkedItem === this.listItem ? 0 : -1;
    }

    return items[0] === this.listItem ? 0 : -1;
  });

  constructor() {
    if (this.list) {
      const list = this.list;
      list.selection.registerItem(this.listItem);
      this.destroyRef.onDestroy(() => list.selection.unregisterItem(this.listItem));
    }
  }

  public select() {
    if (this.effectiveDisabled() || this.effectiveReadonly()) {
      return;
    }

    if (this.list) {
      this.list.selection.select(this.listItem);
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

    const items = this.list.selection.items();
    const currentIndex = items.indexOf(this.listItem);
    let nextIndex = (currentIndex + 1) % items.length;

    while (items[nextIndex]?.disabled() && nextIndex !== currentIndex) {
      nextIndex = (nextIndex + 1) % items.length;
    }

    const nextItem = items[nextIndex];

    if (nextItem && !nextItem.disabled()) {
      // radio pattern selects while roving - readonly only moves focus
      if (!this.list.multiple() && !this.effectiveReadonly()) {
        this.list.selection.select(nextItem);
      }

      this.list.focusItem(nextItem);
    }
  }

  public focusPrevious(event: Event) {
    event.preventDefault();

    if (!this.list || this.effectiveDisabled()) {
      return;
    }

    const items = this.list.selection.items();
    const currentIndex = items.indexOf(this.listItem);
    let prevIndex = (currentIndex - 1 + items.length) % items.length;

    while (items[prevIndex]?.disabled() && prevIndex !== currentIndex) {
      prevIndex = (prevIndex - 1 + items.length) % items.length;
    }

    const prevItem = items[prevIndex];

    if (prevItem && !prevItem.disabled()) {
      // radio pattern selects while roving - readonly only moves focus
      if (!this.list.multiple() && !this.effectiveReadonly()) {
        this.list.selection.select(prevItem);
      }

      this.list.focusItem(prevItem);
    }
  }
}
