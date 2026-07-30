import {
  DestroyRef,
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
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
    // a removed aria-valuenow is the ARIA-sanctioned "indeterminate value" — the valuetext
    // then carries the mixed label so assistive tech announces the bulk-edit state
    '[attr.aria-valuenow]': 'mixed() ? null : (value() ?? 0)',
    '[attr.aria-valuetext]': 'valueText()',
    '[attr.data-mixed]': 'mixed() || null',
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
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  /** `aria-valuetext` announced while `mixed` is set. */
  public mixedLabel = input('Mixed');
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  /**
   * Typed `number | undefined` because signal forms reserves `max` on value controls —
   * a schema `max(...)` validator binds straight into this input.
   */
  public max = input<number | undefined>(5);
  public allowHalf = input(false, { transform: booleanAttribute });

  public effectiveMax = computed(() => this.max() ?? 5);

  public step = computed(() => (this.allowHalf() ? 0.5 : 1));

  /** The value previewed under the pointer, set by the rendered icons. */
  public hoverValue = signal<number | null>(null);

  /**
   * What the icons render: the hover preview wins over the committed value. While mixed,
   * the hidden raw value contributes nothing — no icon fills until the user hovers or commits.
   */
  public displayValue = computed(() => this.hoverValue() ?? (this.mixed() ? 0 : (this.value() ?? 0)));

  public interactive = computed(() => !this.disabled() && !this.readonly());

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.mixed() || this.value() !== null);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.RATING);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredIconTemplate = signal<RatingIconDirective | null>(null);

  protected valueText = computed(() => {
    if (this.mixed()) {
      return this.mixedLabel();
    }

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

    // while mixed there is no visible current value, so a pick always commits — the
    // clear-by-repick shortcut must never fire against the hidden raw value
    if (this.mixed()) {
      this.commitUserValue(clamped);

      return;
    }

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
    // while mixed, nothing reads as filled — keyboard steps start from that visible zero
    const current = this.mixed() ? 0 : (this.value() ?? 0);

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': {
        event.preventDefault();
        this.commitUserValue(Math.min(this.effectiveMax(), current + step));

        return;
      }
      case 'ArrowLeft':
      case 'ArrowDown': {
        event.preventDefault();

        const next = Math.max(0, current - step);

        this.commitUserValue(next === 0 ? null : next);

        return;
      }
      case 'Home': {
        event.preventDefault();
        this.commitUserValue(step);

        return;
      }
      case 'End': {
        event.preventDefault();
        this.commitUserValue(this.effectiveMax());

        return;
      }
      // rating's clear affordance — a deliberate act on a focused single-value control,
      // so unlike a multi-select mass-clear it also resolves mixed
      case 'Backspace':
      case 'Delete': {
        event.preventDefault();
        this.commitUserValue(null);

        return;
      }
    }
  }

  /** Writes a user-chosen value with replace semantics — user commits resolve mixed. */
  private commitUserValue(value: number | null) {
    this.mixed.set(false);
    this.value.set(value);
  }

  private clamp(value: number) {
    const step = this.step();
    const snapped = Math.round(value / step) * step;

    return Math.min(this.effectiveMax(), Math.max(step, snapped));
  }
}
