import { Component, computed, DestroyRef, inject, input, ViewEncapsulation } from '@angular/core';
import { CounterComponentBase, FORM_FIELD_TOKEN } from './headless';

/**
 * How a value's "length" is measured when the consumer doesn't say. Strings and array-likes cover
 * every control that can meaningfully be counted (`et-input`/`et-textarea` and `et-tag-input`
 * respectively); anything else falls back to its string form so a number input still reads sensibly.
 */
const defaultLengthOf = (value: unknown) => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length;
  }

  if (value instanceof Set || value instanceof Map) {
    return value.size;
  }

  return String(value).length;
};

/** Fraction of the limit at which the counter starts announcing how much room is left. */
const ANNOUNCE_FROM_FRACTION = 0.9;

/**
 * The `x / N` character counter in a form field's support region.
 *
 * It sits at the inline-end of the support row and is **persistent** — unlike the hint, it does not
 * swap out when an error appears, because a reader who just crossed the limit needs to see both the
 * error and the count that caused it.
 *
 * The limit comes from `[max]` if given, otherwise from the bound field's schema `maxLength()`
 * (signal forms binds that into the control automatically). With neither, the counter renders the
 * bare count.
 */
@Component({
  selector: 'et-counter',
  // The visible count is hidden from assistive tech and mirrored by a live region that stays empty
  // except at the thresholds that carry information — announcing every keystroke would make typing
  // unusable with a screen reader.
  template: `
    <span aria-hidden="true">{{ current() }}{{ limitSuffix() }}</span>
    <span [attr.aria-live]="announcement() ? 'polite' : null" class="et-counter-announcement">
      {{ announcement() }}
    </span>
  `,
  styleUrl: './counter.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-counter',
    '[attr.data-over-limit]': 'isOverLimit() || null',
  },
})
export class CounterComponent implements CounterComponentBase {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });

  /**
   * The limit to count towards. Wins over the schema's `maxLength()` — use it for a control whose
   * length isn't schema-validated, or to count towards a softer limit than the one that validates.
   */
  public max = input<number | undefined>(undefined);

  /** Measures the control's value. Override for a value type the default can't count. */
  public lengthOf = input<(value: unknown) => number>(defaultLengthOf);

  /** The limit actually in effect: the explicit `[max]`, else the bound field's `maxLength()`. */
  public resolvedMax = computed(() => this.max() ?? this.formField?.controlMaxLength());

  /** The current length of the control's value. */
  public current = computed(() => this.lengthOf()(this.formField?.controlValue() ?? null));

  public isOverLimit = computed(() => {
    const max = this.resolvedMax();

    return max !== undefined && this.current() > max;
  });

  protected limitSuffix = computed(() => {
    const max = this.resolvedMax();

    return max === undefined ? '' : ` / ${max}`;
  });

  protected announcement = computed(() => {
    const max = this.resolvedMax();

    if (max === undefined || max <= 0) {
      return null;
    }

    const current = this.current();

    if (current > max) {
      return `${current - max} characters over the limit of ${max}`;
    }

    if (current === max) {
      return `Character limit of ${max} reached`;
    }

    return current / max >= ANNOUNCE_FROM_FRACTION ? `${max - current} characters remaining` : null;
  });

  constructor() {
    this.formField?.registerCounter(this);
    inject(DestroyRef).onDestroy(() => this.formField?.unregisterCounter(this));
  }
}
