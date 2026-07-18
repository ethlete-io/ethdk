import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { Locale, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { injectDateFormat, injectDateLocale } from '../../date-time-formats';
import { createDatePickerOverlay } from '../../internals/date-picker-overlay';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST, DatePickerHost } from '../../picker/date-picker-host';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateTimeInputFieldDirective } from './date-time-input-field.directive';
import { parseDateTimeText } from './internals/date-time-parse';

/**
 * A combined date & time form control with a `string | null` value (a date-fns
 * `valueFormat` wire string, ISO by default). Typed entry parses strictly
 * against the combined `displayFormat` on blur/Enter, then leniently (date and
 * time split at any separator, bare dates commit at midnight); the anchored
 * picker overlay hosts a calendar and a time picker side by side and stays open
 * across picks. String↔`Date` conversion happens exclusively here — calendar
 * and time picker only ever see `Date` objects.
 */
@Directive({
  selector: '[etDateTimeInput]',
  exportAs: 'etDateTimeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateTimeInputDirective }],
})
export class DateTimeInputDirective implements FormValueControl<string | null>, FormFieldControl, DatePickerHost {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private defaultValueFormat = injectDateFormat();
  private defaultLocale = injectDateLocale();

  /** The wire value in `valueFormat`, or `null` while empty/unparseable. */
  public value = model<string | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  /** Message the form field shows when typed text can't be parsed as a date & time. */
  public parseErrorMessage = input('Please enter a valid date and time');

  /** date-fns format of the string value. Defaults to the `DATE_FORMAT` token. */
  public valueFormat = input<string | undefined>(undefined);
  /** Combined date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('Pp');
  public locale = input<Locale | null>(null);

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);

  public pickerOpen = model(false);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** The current value as a `Date` (what the picker calendar and time picker bind to). */
  public dateTime = computed(() => {
    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });
  });

  /** The committed value rendered in `displayFormat`. */
  public displayValue = computed(() => {
    const dateTime = this.dateTime();

    if (dateTime === null) {
      return '';
    }

    return formatDateValue(dateTime, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /** Uncommitted field text — kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse, even leniently. */
  public parseError = signal(false);

  public focused = signal(false);
  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_TIME_INPUT);

  /** @internal */
  public registeredField = signal<DateTimeInputFieldDirective | null>(null);
  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());
  public hasValue = computed(() => this.value() !== null || this.inputText().length > 0);
  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  private overlay = createDatePickerOverlay({
    interactive: this.interactive,
    pickerOpen: this.pickerOpen,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    context: () => ({ $implicit: this, close: () => this.closePicker() }),
    onAfterClosed: ({ byOutsidePointer, fromBottomSheet }) => {
      // focus fell to <body> with the pane's removal — hand it back to the field,
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
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus();
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

  /**
   * @internal Commits typed field text: empty clears, a strict-then-lenient
   * parse writes the value, anything else keeps the raw text and raises
   * `parseError` (the value stays `null`).
   */
  public commitInput(raw: string) {
    if (!raw.trim()) {
      this.inputText.set('');
      this.parseError.set(false);

      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    const parsed = parseDateTimeText(raw, { format: this.displayFormat(), locale: this.effectiveLocale() });

    if (parsed === null) {
      this.inputText.set(raw);
      this.parseError.set(true);

      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.commitDateTime(parsed);
  }

  /**
   * Commits a calendar-picked day, keeping the committed time of day (midnight
   * while there is none yet). The picker stays open — the user likely still
   * wants to pick a time.
   */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    const current = this.dateTime();
    const day = startOfDay(date);

    this.commitDateTime(
      current === null
        ? day
        : setSeconds(setMinutes(setHours(day, current.getHours()), current.getMinutes()), current.getSeconds()),
    );
    this.touched.set(true);
  }

  /**
   * Commits a picker-selected time onto the committed day (the picked time's
   * own day — today — while there is none yet). The picker stays open — a time
   * takes one selection per column.
   */
  public selectTime(time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    const current = this.dateTime();
    const day = startOfDay(current ?? time);

    this.commitDateTime(setSeconds(setMinutes(setHours(day, time.getHours()), time.getMinutes()), time.getSeconds()));
    this.touched.set(true);
  }

  private commitDateTime(dateTime: Date) {
    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(dateTime, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
  }

  // the field is the anchor inside a form field so the panel lines up with the visible box
  private resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.registeredField()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }
}
