import {
  DestroyRef,
  Directive,
  Signal,
  WritableSignal,
  computed,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { FORM_FIELD, FormValueControl } from '@angular/forms/signals';
import { FormFieldControl } from '../../form-field/headless';
import { parseDateValue } from './date-value';
import { DatePickerInputFieldBase, PickerInputBaseDirective } from './picker-input-base.directive';
import { resolvePickerCommit } from './picker-input-commit';
import { formatInZone, reinterpretInZone, zonedProxy } from './time-zone';

/** The two wire strings a range control holds; a side is `null` while empty/unparseable. */
export type DateRangeValue = {
  start: string | null;
  end: string | null;
};

export type DateRangeSide = 'start' | 'end';

export const DATE_RANGE_SIDES = ['start', 'end'] as const;

type SideState = {
  inputText: WritableSignal<string>;
  parseError: WritableSignal<boolean>;
  field: WritableSignal<DatePickerInputFieldBase | null>;
};

type RegisterFieldOptions = {
  side: DateRangeSide;
  field: DatePickerInputFieldBase;
  duplicateFieldError: () => RuntimeError<number>;
};

/**
 * Shared host for the two-sided range picker inputs (`et-date-range-input`, `et-time-range-input`,
 * `et-date-time-range-input`): one registered field-control containing two text inputs that share a
 * single range-mode picker, on top of `PickerInputBaseDirective`.
 *
 * Must be extended by an `@Directive` - Angular only surfaces inherited inputs from a decorated base.
 */
@Directive()
export abstract class DateRangePickerInputDirective
  extends PickerInputBaseDirective
  implements FormValueControl<DateRangeValue>, FormFieldControl
{
  private ngFormField = inject(FORM_FIELD, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** The message the form field shows when either side's typed text does not parse. */
  public abstract resolvedParseErrorMessage: Signal<string>;

  /**
   * @internal Parses one side's typed text into the `Date` that should be committed, or `null` when
   * nothing parses.
   */
  public abstract parseSideCommit(raw: string): Date | null;

  /** Wire values in `valueFormat`; a side is `null` while empty/unparseable. */
  public value = model<DateRangeValue>({ start: null, end: null });
  public startPlaceholder = input('');
  public endPlaceholder = input('');

  /**
   * Accessible name of the start field, which is the named widget - the group around both fields
   * takes the projected `<et-label>` (or the control's own `aria-label`) instead.
   */
  public startAriaLabel = input<string | null>(null);
  /** Accessible name of the end field. See {@link startAriaLabel}. */
  public endAriaLabel = input<string | null>(null);

  /** The IANA zone both fields' wall clock stands for, or `null` to stay in the runtime's own zone. */
  public effectiveTimeZone: Signal<string | null> = signal(null);

  /** The side the focused field edits. */
  public focusedSide = signal<DateRangeSide | null>(null);

  private sides: Record<DateRangeSide, SideState> = {
    start: { inputText: signal(''), parseError: signal(false), field: signal(null) },
    end: { inputText: signal(''), parseError: signal(false), field: signal(null) },
  };

  public startDate = computed(() => (this.mixed() ? null : this.parseSide(this.value().start)));
  public endDate = computed(() => (this.mixed() ? null : this.parseSide(this.value().end)));

  /** The two committed ends as `Date` objects - what the picker's calendar and time picker bind to. */
  public calendarRange = computed(() => ({ start: this.startDate(), end: this.endDate() }));

  public startParseError: Signal<boolean> = this.sides.start.parseError.asReadonly();
  public endParseError: Signal<boolean> = this.sides.end.parseError.asReadonly();
  public parseError = computed(() => this.startParseError() || this.endParseError());

  public focused = computed(() => this.focusedSide() !== null || this.pickerOpen());
  public hasValue = computed(() => {
    if (this.mixed()) {
      return true;
    }

    const { start, end } = this.value();

    return (
      start !== null ||
      end !== null ||
      this.sides.start.inputText().length > 0 ||
      this.sides.end.inputText().length > 0 ||
      this.displayValue('start') !== '' ||
      this.displayValue('end') !== ''
    );
  });

  /**
   * A range is named as a group: by the author's `aria-label`/`aria-labelledby` on the control, or
   * by naming both of its fields.
   */
  public override hasCustomAccessibleName = computed(
    () =>
      !!this.ariaLabel()?.trim() ||
      !!this.ariaLabelledby()?.trim() ||
      (!!this.startAriaLabel()?.trim() && !!this.endAriaLabel()?.trim()),
  );

  private formFieldControlView: FormFieldControl = {
    touched: this.touched,
    invalid: this.invalid,
    errors: computed(() => this.ngFormField?.state().errorSummary() ?? this.errors()),
    name: this.name,
    required: this.required,
    disabled: this.disabled,
    readonly: this.readonly,
    describedBy: this.describedBy,
    // both are subclass fields, which initialize after this one - reading them through a computed
    // defers it past construction. Assigning them directly would register `undefined`.
    controlType: computed(() => this.controlType()),
    resolvedParseErrorMessage: computed(() => this.resolvedParseErrorMessage()),
    focused: this.focused,
    expanded: this.expanded,
    hasValue: this.hasValue,
    parseError: this.parseError,
    hasCustomAccessibleName: this.hasCustomAccessibleName,
    activate: () => this.activate(),
  };

  protected readonly KEEPS_FOCUS_ON_FOCUS_LEAVE = false;

  constructor() {
    super();

    this.formField?.registerControl(this.formFieldControlView);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this.formFieldControlView));
  }

  public inputText(side: DateRangeSide) {
    return this.sides[side].inputText();
  }

  public sideParseError(side: DateRangeSide) {
    return this.sides[side].parseError();
  }

  /** The committed value of one side rendered in the format in effect. */
  public displayValue(side: DateRangeSide) {
    const date = this.sideDate(side);

    if (date === null) {
      return '';
    }

    return (
      formatInZone(date, {
        format: this.effectiveDisplayFormat(),
        locale: this.effectiveLocale(),
        timeZone: this.effectiveTimeZone(),
      }) ?? ''
    );
  }

  /** The committed `Date` of one side, or `null` while that side is empty (or the value is masked). */
  public sideDate(side: DateRangeSide) {
    return side === 'start' ? this.startDate() : this.endDate();
  }

  /**
   * One side as the calendar and the time picker see it: a plain `Date` whose local wall clock is
   * the zone's. Highlighting only - see `zonedProxy`.
   */
  public pickerSideDate(side: DateRangeSide) {
    const date = this.sideDate(side);
    const timeZone = this.effectiveTimeZone();

    return date === null || timeZone === null ? date : zonedProxy(date, timeZone);
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    const target = this.mixed() || this.value().start === null || this.value().end !== null ? 'start' : 'end';

    this.sides[target].field()?.focus(options);
  }

  /** @internal */
  public setInputText(side: DateRangeSide, text: string) {
    this.sides[side].inputText.set(text);
  }

  /**
   * @internal Commits one side's typed text, with the subclass's parse rules: empty clears that
   * side, a successful parse writes it, anything else keeps the raw text and raises `parseError`.
   */
  public commitSide(side: DateRangeSide, raw: string) {
    const outcome = resolvePickerCommit(raw, {
      displayValue: this.displayValue(side),
      parseError: this.sideParseError(side),
      interactive: this.interactive(),
      parse: (text) => this.parseSideCommit(text),
    });

    if (outcome === null) {
      return;
    }

    this.beforeCommitSide(side);

    const state = this.sides[side];

    state.inputText.set(outcome.text);
    state.parseError.set(outcome.text.length > 0);

    if (outcome.parsed !== null) {
      this.commitSideValue(side, this.formatSide(reinterpretInZone(outcome.parsed, this.effectiveTimeZone())));

      return;
    }

    if (!this.mixed()) {
      this.writeSide(side, null);
    }
  }

  /** @internal Runs once a side's commit is known to apply. */
  public beforeCommitSide(side: DateRangeSide) {
    void side;
  }

  /** Clears both sides and any uncommitted field text - wired to the styled input's clear button. */
  public clearRange() {
    if (!this.interactive()) {
      return;
    }

    this.value.set({ start: null, end: null });
    this.mixed.set(false);

    for (const side of DATE_RANGE_SIDES) {
      this.clearSideText(side);
      this.sides[side].field()?.resetText();
    }
  }

  /**
   * @internal Both reads are untracked: a field registers from an effect, so a tracked read of the
   * signal the same call writes re-runs that effect forever.
   */
  public registerField({ side, field, duplicateFieldError }: RegisterFieldOptions) {
    if (ngDevMode && untracked(() => this.sides[side].field())) {
      throw duplicateFieldError();
    }

    this.sides[side].field.set(field);
  }

  /** @internal See {@link registerField} for why the read is untracked. */
  public unregisterField(side: DateRangeSide, field: DatePickerInputFieldBase) {
    if (untracked(() => this.sides[side].field()) === field) {
      this.sides[side].field.set(null);
    }
  }

  /** @internal One side's committed instant rendered in `valueFormat`, with the field zone's offset. */
  public formatSide(instant: Date) {
    return formatInZone(instant, {
      format: this.effectiveValueFormat(),
      locale: this.effectiveLocale(),
      timeZone: this.effectiveTimeZone(),
    });
  }

  /** @internal Commits one side's `Date`, dropping that side's pending field text. */
  public commitSideDate(side: DateRangeSide, instant: Date) {
    this.clearSideText(side);
    this.commitSideValue(side, this.formatSide(instant));
  }

  /**
   * @internal Writes one resolving side value. While mixed, replace semantics apply: the hidden raw
   * range is dropped rather than merged into.
   */
  public commitSideValue(side: DateRangeSide, sideValue: string | null) {
    if (this.mixed()) {
      this.value.set({ start: null, end: null, [side]: sideValue });
      this.mixed.set(false);

      return;
    }

    this.writeSide(side, sideValue);
  }

  /**
   * @internal Writes a picker-selected range: both sides at once, any pending field text dropped,
   * and the masked bulk-edit state resolved.
   */
  public writeRange(range: { start: Date | null; end: Date | null }) {
    for (const side of DATE_RANGE_SIDES) {
      this.clearSideText(side);
    }

    this.value.set({
      start: range.start === null ? null : this.formatSide(range.start),
      end: range.end === null ? null : this.formatSide(range.end),
    });
    this.mixed.set(false);
  }

  /** @internal Drops one side's uncommitted text and its parse error. */
  public clearSideText(side: DateRangeSide) {
    this.sides[side].inputText.set('');
    this.sides[side].parseError.set(false);
  }

  protected anchorField() {
    return this.sides.start.field();
  }

  private parseSide(value: string | null) {
    if (value === null) {
      return null;
    }

    return parseDateValue(value, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });
  }

  private writeSide(side: DateRangeSide, sideValue: string | null) {
    const current = this.value();

    if (current[side] !== sideValue) {
      this.value.set({ ...current, [side]: sideValue });
    }
  }
}
