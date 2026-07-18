import { DestroyRef, Directive, ElementRef, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { RatingIconDirective } from './rating-icon.directive';

export type RatingIconState = 'full' | 'half' | 'empty';

@Directive({
  selector: '[etRating]',
  exportAs: 'etRating',
  host: {
    role: 'slider',
    'aria-orientation': 'horizontal',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    'aria-valuemin': '0',
    '[attr.aria-valuemax]': 'effectiveMax()',
    '[attr.aria-valuenow]': 'value() ?? 0',
    '[attr.aria-valuetext]': 'valueText()',
    '[attr.aria-readonly]': 'readonly() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-labelledby]': 'labelId()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-readonly]': 'readonly() || null',
    '(keydown)': 'handleKeydown($event)',
    '(focus)': 'focused.set(true)',
    '(blur)': 'handleBlur()',
    '(pointerleave)': 'clearHover()',
  },
})
export class RatingDirective implements FormValueControl<number | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public value = model<number | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  /**
   * Typed `number | undefined` because signal forms reserves `max` on value controls —
   * a schema `max(...)` validator binds straight into this input.
   */
  public max = input<number | undefined>(5);
  public allowHalf = input(false);

  public effectiveMax = computed(() => this.max() ?? 5);

  public step = computed(() => (this.allowHalf() ? 0.5 : 1));

  /** The value previewed under the pointer, set by the rendered icons. */
  public hoverValue = signal<number | null>(null);

  /** What the icons render: the hover preview wins over the committed value. */
  public displayValue = computed(() => this.hoverValue() ?? this.value() ?? 0);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value() !== null);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.RATING);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredIconTemplate = signal<RatingIconDirective | null>(null);

  protected valueText = computed(() => {
    const value = this.value();

    return value === null ? 'No rating' : `${value} of ${this.effectiveMax()}`;
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  /** The state icon `index` (1-based) renders for a given display value. */
  public iconState(index: number): RatingIconState {
    const display = this.displayValue();

    if (display >= index) {
      return 'full';
    }

    return display >= index - 0.5 ? 'half' : 'empty';
  }

  public setHoverValue(value: number) {
    if (!this.interactive()) {
      return;
    }

    this.hoverValue.set(this.clamp(value));
  }

  public clearHover() {
    this.hoverValue.set(null);
  }

  /** Commits from a pointer interaction — picking the current value again clears the rating. */
  public commitPointer(value: number) {
    if (!this.interactive()) {
      return;
    }

    const clamped = this.clamp(value);

    this.value.set(clamped === this.value() ? null : clamped);
  }

  protected handleBlur() {
    this.focused.set(false);
    this.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (!this.interactive() || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const step = this.step();
    const current = this.value() ?? 0;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': {
        event.preventDefault();
        this.value.set(Math.min(this.effectiveMax(), current + step));

        return;
      }
      case 'ArrowLeft':
      case 'ArrowDown': {
        event.preventDefault();

        const next = Math.max(0, current - step);

        this.value.set(next === 0 ? null : next);

        return;
      }
      case 'Home': {
        event.preventDefault();
        this.value.set(step);

        return;
      }
      case 'End': {
        event.preventDefault();
        this.value.set(this.effectiveMax());

        return;
      }
      case 'Backspace':
      case 'Delete': {
        event.preventDefault();
        this.value.set(null);

        return;
      }
    }
  }

  private clamp(value: number) {
    const step = this.step();
    const snapped = Math.round(value / step) * step;

    return Math.min(this.effectiveMax(), Math.max(step, snapped));
  }
}
