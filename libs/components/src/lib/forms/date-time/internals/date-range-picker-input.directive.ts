import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  Signal,
  WritableSignal,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { FORM_FIELD, FormValueControl, ValidationError } from '@angular/forms/signals';
import { Locale } from 'date-fns';
import {
  AccessibleNameControlDirective,
  FORM_FIELD_TOKEN,
  FormFieldControl,
  FormFieldControlType,
} from '../../form-field/headless';
import { mountControlSuffixStyles } from '../../form-field/form-field-control-suffix-styles.component';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { injectDateLocale } from '../date-time-formats';
import { DatePickerHost, DatePickerSurfaceBase, DatePickerTriggerBase } from '../picker/date-picker-host';
import { DatePickerInputFieldBase } from './date-picker-input.directive';
import { createDatePickerOverlay } from './date-picker-overlay';
import { parseDateValue } from './date-value';
import { formatInZone, reinterpretInZone, zonedProxy } from './time-zone';
import { maskPatternFromDisplayFormat } from './display-format-mask';
import { resolvePickerCommit } from './picker-input-commit';

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
 * single range-mode picker.
 *
 * Must be extended by an `@Directive` - Angular only surfaces inherited inputs from a decorated base.
 */
@Directive({
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export abstract class DateRangePickerInputDirective
  extends AccessibleNameControlDirective
  implements FormValueControl<DateRangeValue>, FormFieldControl, DatePickerHost
{
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private ngFormField = inject(FORM_FIELD, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);

  public defaultLocale = injectDateLocale();

  /** date-fns wire format used when `valueFormat` is unset - the token differs per control. */
  protected abstract defaultValueFormat: string;
  /** The form-field control-type tag (date-range-input / time-range-input / date-time-range-input). */
  public abstract controlType: Signal<FormFieldControlType>;
  /** The date-fns format in effect for both fields - declared per control. */
  public abstract effectiveDisplayFormat: Signal<string>;
  /** The message the form field shows when either side's typed text does not parse. */
  public abstract resolvedParseErrorMessage: Signal<string>;

  /**
   * @internal Parses one side's typed text into the `Date` that should be committed, or `null` when
   * nothing parses.
   */
  public abstract parseSideCommit(raw: string): Date | null;

  /** Wire values in `valueFormat`; a side is `null` while empty/unparseable. */
  public value = model<DateRangeValue>({ start: null, end: null });
  /**
   * View state for a field whose source values disagree (bulk edit). One flag masks
   * the whole range value - not per side.
   */
  public mixed = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public startPlaceholder = input('');
  public endPlaceholder = input('');

  /**
   * Accessible name of the start field, which is the named widget - the group around both fields
   * takes the projected `<et-label>` (or the control's own `aria-label`) instead.
   */
  public startAriaLabel = input<string | null>(null);
  /** Accessible name of the end field. See {@link startAriaLabel}. */
  public endAriaLabel = input<string | null>(null);
  /**
   * Placeholder both fields show while `mixed` is set. Presentation only - it never enters the form
   * value.
   */
  public mixedLabel = input<string | null>(null);

  /** date-fns format of the string values. Defaults to the `DATE_FORMAT` token. */
  public valueFormat = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);

  /**
   * Opt-in typing mask: when `displayFormat` is fixed-width numeric (`dd.MM.yyyy`),
   * both fields get guide placeholders (`__.__.____`), auto-inserted separators,
   * and paste filtering. Formats the mask cannot represent - locale formats like
   * `P`/`Pp`, variable-width or text tokens - are refused and typing stays
   * unmasked.
   */
  public mask = input(false, { transform: booleanAttribute });

  public pickerOpen = model(false);

  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);

  /** The IANA zone both fields' wall clock stands for, or `null` to stay in the runtime's own zone. */
  public effectiveTimeZone: Signal<string | null> = signal(null);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

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

  public describedBy = signal<string | null>(null);

  /**
   * @internal Ids the control contributes to `aria-describedby` itself, on top of the one the form
   * field sets.
   */
  public ownDescribedBy: Signal<string | null> = signal(null);

  /** @internal Everything the fields' `aria-describedby` must point at, in reading order. */
  public describedByIds = computed(() => {
    const ids = [this.describedBy(), this.ownDescribedBy()].filter((id): id is string => id !== null && id !== '');

    return ids.length > 0 ? ids.join(' ') : null;
  });
  public focused = computed(() => this.focusedSide() !== null || this.pickerOpen());
  /** @internal Keeps the form field in its focused style while the picker overlay is open. */
  public expanded = computed(() => this.pickerOpen());

  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerBase | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceBase | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());

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

  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

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

  /** The `[etInputMask]` pattern derived from the format in effect - `null` while `mask` is off or the format is refused. */
  public maskPattern = computed(() =>
    this.mask() ? maskPatternFromDisplayFormat(this.effectiveDisplayFormat()) : null,
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

  private overlay = createDatePickerOverlay({
    interactive: this.interactive,
    pickerOpen: this.pickerOpen,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    context: () => ({ $implicit: this, close: () => this.closePicker() }),
    onAfterClosed: ({ byOutsidePointer, fromBottomSheet }) => {
      if (!byOutsidePointer && !fromBottomSheet && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
  });

  constructor() {
    super();

    mountTextFieldShellStyles();
    mountControlSuffixStyles();

    this.formField?.registerControl(this.formFieldControlView);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this.formFieldControlView));

    if (ngDevMode) {
      effect(() => {
        if (this.mask() && this.maskPattern() === null) {
          console.warn(
            `[et-${this.controlType()}] displayFormat "${this.effectiveDisplayFormat()}" is not fixed-width numeric, so no typing mask can be derived - the mask input is ignored.`,
          );
        }
      });
    }
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

  public activate() {
    this.focus();
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    const target = this.mixed() || this.value().start === null || this.value().end !== null ? 'start' : 'end';

    this.sides[target].field()?.focus(options);
  }

  public openPicker() {
    if (!this.interactive() || this.pickerOpen()) {
      return;
    }

    this.pickerOpen.set(true);
  }

  public closePicker() {
    if (this.pickerOpen()) {
      this.pickerOpen.set(false);
    }

    this.overlay.close();
  }

  public togglePicker() {
    if (this.pickerOpen()) {
      this.closePicker();
    } else {
      this.openPicker();
    }
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

  private resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.sides.start.field()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }
}
