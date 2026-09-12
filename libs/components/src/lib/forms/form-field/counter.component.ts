import { Component, computed, DestroyRef, inject, input, ViewEncapsulation } from '@angular/core';
import { CounterComponentBase, FORM_FIELD_TOKEN } from './headless';

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

const ANNOUNCE_FROM_FRACTION = 0.9;

/**
 * The `x / N` character counter in a form field's support region.
 *
 * The limit comes from `[max]` if given, otherwise from the bound field's schema `maxLength()`
 * (signal forms binds that into the control automatically). With neither, the counter renders the
 * bare count.
 */
@Component({
  selector: 'et-counter',
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
   * The limit to count towards. Wins over the schema's `maxLength()` - use it for a control whose
   * length isn't schema-validated, or to count towards a softer limit than the one that validates.
   */
  public max = input<number | undefined>(undefined);

  /** Measures the control's value. Override for a value type the default can't count. */
  public lengthOf = input<(value: unknown) => number>(defaultLengthOf);

  /** The limit actually in effect: the explicit `[max]`, else the bound field's `maxLength()`. */
  public resolvedMax = computed(() => this.max() ?? this.formField?.controlMaxLength());

  /** The current length of the control's value. */
  public current = computed(() => this.lengthOf()(this.formField?.controlValue() ?? null));

  /**
   * Whether the value is past the limit. With a schema `maxLength()` this is the control's own
   * validation error.
   */
  public isOverLimit = computed(() => {
    const explicitMax = this.max();

    if (explicitMax !== undefined) {
      return this.current() > explicitMax;
    }

    return this.formField?.errors().some((error) => error.kind === 'maxLength') ?? false;
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

    if (this.isOverLimit()) {
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
