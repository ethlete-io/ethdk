import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  Signal,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { Locale, startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { injectDateFormat, injectDateLocale } from '../../date-time-formats';
import { createDatePickerOverlay } from '../../internals/date-picker-overlay';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { maskPatternFromDisplayFormat } from '../../internals/display-format-mask';
import { DATE_PICKER_HOST, DatePickerHost } from '../../picker/date-picker-host';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateRangeInputFieldDirective } from './date-range-input-field.directive';
import { injectFormFieldLabels } from '../../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';

export type DateRangeValue = {
  start: string | null;
  end: string | null;
};

export type DateRangeSide = 'start' | 'end';

type SideState = {
  /** Uncommitted field text — kept visible when it fails to parse. */
  inputText: ReturnType<typeof signal<string>>;
  parseError: ReturnType<typeof signal<boolean>>;
  field: ReturnType<typeof signal<DateRangeInputFieldDirective | null>>;
};

/**
 * A date range form control: one registered field-control containing two text
 * inputs that share a single range-mode calendar picker. The value is
 * `{ start, end }` of `valueFormat` wire strings; each side parses strictly
 * against `displayFormat` on blur/Enter, exactly like the single date input.
 */
@Directive({
  selector: '[etDateRangeInput]',
  exportAs: 'etDateRangeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateRangeInputDirective }],
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class DateRangeInputDirective implements FormValueControl<DateRangeValue>, FormFieldControl, DatePickerHost {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private defaultValueFormat = injectDateFormat();
  private defaultLocale = injectDateLocale();

  /** Wire values in `valueFormat`; a side is `null` while empty/unparseable. */
  public value = model<DateRangeValue>({ start: null, end: null });
  /**
   * View state for a field whose source values disagree (bulk edit). One flag masks
   * the whole range value — not per side. The raw form value stays untouched.
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
   * Placeholder both fields show while `mixed` is set. Presentation only — a masked
   * date field cannot render arbitrary text, so the fields stay empty and the label
   * shows through the placeholder slot; it never enters the form value.
   */
  public mixedLabel = input<string | null>(null);

  /** Message the form field shows when either side's typed text can't be parsed as a date. */
  public parseErrorMessage = input<string | null>(null);

  /** date-fns format of the string values. Defaults to the `DATE_FORMAT` token. */
  public valueFormat = input<string | undefined>(undefined);
  /** date-fns format shown in (and parsed from) the fields. Locale-aware by default. */
  public displayFormat = input('P');
  public locale = input<Locale | null>(null);

  /**
   * Opt-in typing mask: when `displayFormat` is fixed-width numeric (`dd.MM.yyyy`),
   * both fields get guide placeholders (`__.__.____`), auto-inserted separators,
   * and paste filtering. Formats the mask cannot represent — locale formats like
   * the default `P`, variable-width or text tokens — are refused and typing stays
   * unmasked. Commit parsing is identical either way: the lenient blur/Enter
   * parsers stay authoritative.
   */
  public mask = input(false, { transform: booleanAttribute });

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);

  public pickerOpen = model(false);

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  /** The string in effect: this instance's `parseErrorMessage`, else the domain's label set. */
  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDateRange);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** The side the focused field edits — the picker previews from here too. */
  public focusedSide = signal<DateRangeSide | null>(null);

  private sides: Record<DateRangeSide, SideState> = {
    start: { inputText: signal(''), parseError: signal(false), field: signal(null) },
    end: { inputText: signal(''), parseError: signal(false), field: signal(null) },
  };

  // masking: while mixed the hidden raw range is neither rendered in the fields
  // (displayValue derives from here) nor highlighted in the picker calendar
  public startDate = computed(() => (this.mixed() ? null : this.parseSide(this.value().start)));
  public endDate = computed(() => (this.mixed() ? null : this.parseSide(this.value().end)));

  /** What the picker calendar binds to (`Date` objects, day-granular use). */
  public calendarRange = computed(() => ({ start: this.startDate(), end: this.endDate() }));

  public startParseError: Signal<boolean> = this.sides.start.parseError.asReadonly();
  public endParseError: Signal<boolean> = this.sides.end.parseError.asReadonly();
  public parseError = computed(() => this.startParseError() || this.endParseError());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_RANGE_INPUT);
  public focused = computed(() => this.focusedSide() !== null || this.pickerOpen());
  /** @internal Keeps the form field in its focused style while the picker overlay is open. */
  public expanded = computed(() => this.pickerOpen());

  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  public hasValue = computed(() => {
    if (this.mixed()) {
      return true;
    }

    const { start, end } = this.value();

    return (
      start !== null || end !== null || this.sides.start.inputText().length > 0 || this.sides.end.inputText().length > 0
    );
  });

  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** The `[etInputMask]` pattern derived from `displayFormat` — `null` while `mask` is off or the format is refused. */
  public maskPattern = computed(() => (this.mask() ? maskPatternFromDisplayFormat(this.displayFormat()) : null));

  private overlay = createDatePickerOverlay({
    interactive: this.interactive,
    pickerOpen: this.pickerOpen,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    context: () => ({ $implicit: this, close: () => this.closePicker() }),
    onAfterClosed: ({ byOutsidePointer, fromBottomSheet }) => {
      // focus fell to <body> with the pane's removal — hand it back to the fields,
      // except for outside closes (the user deliberately went elsewhere) and
      // bottom-sheet closes (refocusing would pop the soft keyboard)
      if (!byOutsidePointer && !fromBottomSheet && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    if (ngDevMode) {
      // a refused format silently behaving like `mask: false` would be a head-scratcher
      effect(() => {
        if (this.mask() && this.maskPattern() === null) {
          console.warn(
            `[et-${this.controlType()}] displayFormat "${this.displayFormat()}" is not fixed-width numeric, so no typing mask can be derived — the mask input is ignored.`,
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

  /** The committed value of one side rendered in `displayFormat`. */
  public displayValue(side: DateRangeSide) {
    const date = side === 'start' ? this.startDate() : this.endDate();

    if (date === null) {
      return '';
    }

    return formatDateValue(date, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    // the first empty side, else start — mirrors where the next interaction lands.
    // While mixed both fields read as empty, so a fresh entry starts at the start side
    const target = this.mixed() || this.value().start === null || this.value().end !== null ? 'start' : 'end';

    this.sides[target].field()?.focus();
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

  /** @internal Same commit semantics as the date input, per side. */
  public commitSide(side: DateRangeSide, raw: string) {
    const state = this.sides[side];

    if (!raw.trim()) {
      state.inputText.set('');
      state.parseError.set(false);

      // while mixed the fields are empty anyway — a blank commit is a plain blur, not a
      // user clear, so the hidden raw range survives
      if (!this.mixed()) {
        this.writeSide(side, null);
      }

      return;
    }

    // reference midnight so a date-only `displayFormat` doesn't fold the current wall-clock
    // time into a time-bearing `valueFormat` — see the note in date-input's `commitInput`.
    const parsed = parseDateValue(raw, {
      format: this.displayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: startOfDay(new Date()),
    });

    if (parsed === null) {
      state.inputText.set(raw);
      state.parseError.set(true);

      // a failed parse resolves nothing: mixed stays set and the masked raw range untouched
      if (!this.mixed()) {
        this.writeSide(side, null);
      }

      return;
    }

    state.inputText.set('');
    state.parseError.set(false);

    const formatted = formatDateValue(parsed, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });

    // replace semantics: the first resolving commit starts a fresh range — the hidden
    // other side must not leak into the new value
    if (this.mixed()) {
      this.value.set({ start: null, end: null, [side]: formatted });
      this.mixed.set(false);

      return;
    }

    this.writeSide(side, formatted);
  }

  /** Commits a picker range; a completed range closes the picker. */
  public selectCalendarRange(range: { start: Date | null; end: Date | null }) {
    if (!this.interactive()) {
      return;
    }

    const options = { format: this.effectiveValueFormat(), locale: this.effectiveLocale() };

    for (const side of ['start', 'end'] as const) {
      this.sides[side].inputText.set('');
      this.sides[side].parseError.set(false);
    }

    this.value.set({
      start: range.start === null ? null : formatDateValue(range.start, options),
      end: range.end === null ? null : formatDateValue(range.end, options),
    });
    // the calendar showed no selection while mixed, so this is the normal range-building
    // flow starting fresh — the first pick already replaces the whole hidden range
    this.mixed.set(false);

    if (range.start !== null && range.end !== null) {
      this.touched.set(true);
      this.closePicker();
    }
  }

  /** Clears both sides and any uncommitted field text — wired to the styled input's clear button. */
  public clearRange() {
    if (!this.interactive()) {
      return;
    }

    this.value.set({ start: null, end: null });
    this.mixed.set(false);

    for (const side of ['start', 'end'] as const) {
      this.sides[side].inputText.set('');
      this.sides[side].parseError.set(false);
      // the field only mirrors state while unfocused; a clear happens while focused, so blank the element directly
      const el = this.sides[side].field()?.elementRef.nativeElement;
      if (el) {
        el.value = '';
      }
    }
  }

  /** @internal */
  public registerField(side: DateRangeSide, field: DateRangeInputFieldDirective) {
    this.sides[side].field.set(field);
  }

  /** @internal */
  public unregisterField(side: DateRangeSide, field: DateRangeInputFieldDirective) {
    if (this.sides[side].field() === field) {
      this.sides[side].field.set(null);
    }
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

  // inside a form field the visible box is the control frame — anchor the panel there
  private resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.sides.start.field()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }
}
