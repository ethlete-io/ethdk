import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FormFieldControl } from '../../form-field/headless';
import { RADIO_GROUP_TOKEN } from '../../radio-group/radio-group.tokens';

let uniqueRadioLabelId = 0;

@Directive({
  selector: '[etRadio]',
  host: {
    role: 'radio',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-disabled]': 'effectiveDisabled() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedById() || null',
    '[attr.aria-labelledby]': 'labelId()',
    '[attr.tabindex]': 'tabindex()',
    '(click)': 'select()',
    '(keydown.space)': 'select(); $event.preventDefault()',
    '(keydown.ArrowDown)': 'focusNext($event)',
    '(keydown.ArrowRight)': 'focusNext($event)',
    '(keydown.ArrowUp)': 'focusPrevious($event)',
    '(keydown.ArrowLeft)': 'focusPrevious($event)',
    '(blur)': 'markTouched()',
  },
})
export class RadioDirective implements FormFieldControl {
  private radioGroup = inject(RADIO_GROUP_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject(ElementRef);

  public value = input.required<unknown>();
  public checked = model(false);
  public touched = model(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public effectiveDisabled = computed(() => this.disabled() || (this.radioGroup?.disabled() ?? false));
  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.RADIO);

  public labelId = signal(`et-radio-label-${uniqueRadioLabelId++}`);
  public describedById = computed(() => this.describedBy());

  private groupItem = { value: this.value, checked: this.checked, elementRef: this.el };

  public tabindex = computed(() => {
    if (this.effectiveDisabled()) {
      return -1;
    }

    if (!this.radioGroup) {
      return 0;
    }

    const items = this.radioGroup.items();
    const checkedItem = items.find((i) => i.checked());

    if (checkedItem) {
      return checkedItem === this.groupItem ? 0 : -1;
    }

    return items[0] === this.groupItem ? 0 : -1;
  });

  constructor() {
    if (this.radioGroup) {
      const group = this.radioGroup;
      group.registerItem(this.groupItem);
      this.destroyRef.onDestroy(() => group.unregisterItem(this.groupItem));
    }
  }

  public select() {
    if (this.effectiveDisabled()) {
      return;
    }

    if (this.radioGroup) {
      this.radioGroup.select(this.groupItem);
    } else {
      this.checked.set(true);
    }
  }

  public activate() {
    if (this.effectiveDisabled()) return;

    this.select();
    this.el.nativeElement.focus();
  }

  public markTouched() {
    this.touched.set(true);

    if (this.radioGroup) {
      this.radioGroup.markTouched();
    }
  }

  public focusNext(event: Event) {
    event.preventDefault();

    if (!this.radioGroup || this.effectiveDisabled()) return;

    const items = this.radioGroup.items();
    const currentIndex = items.indexOf(this.groupItem);
    const nextIndex = (currentIndex + 1) % items.length;
    const nextItem = items[nextIndex];

    if (nextItem) {
      this.radioGroup.select(nextItem);
      this.radioGroup.focusItem(nextItem);
    }
  }

  public focusPrevious(event: Event) {
    event.preventDefault();

    if (!this.radioGroup || this.effectiveDisabled()) return;

    const items = this.radioGroup.items();
    const currentIndex = items.indexOf(this.groupItem);
    const prevIndex = (currentIndex - 1 + items.length) % items.length;
    const prevItem = items[prevIndex];

    if (prevItem) {
      this.radioGroup.select(prevItem);
      this.radioGroup.focusItem(prevItem);
    }
  }
}
