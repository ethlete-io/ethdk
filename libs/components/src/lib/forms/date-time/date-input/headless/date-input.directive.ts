import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { Locale } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { injectDateFormat, injectDateLocale } from '../../date-time-formats';
import { createDatePickerOverlay } from '../../internals/date-picker-overlay';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST, DatePickerHost } from '../../picker/date-picker-host';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { DateInputFieldDirective } from './date-input-field.directive';

/**
 * A date form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, ISO by default). Typed entry parses strictly against
 * `displayFormat` on blur/Enter; the anchored picker overlay hosts a calendar.
 * String↔`Date` conversion happens exclusively here — the calendar itself
 * only ever sees `Date` objects.
 */
@Directive({
  selector: '[etDateInput]',
  exportAs: 'etDateInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: DateInputDirective }],
})
export class DateInputDirective implements FormValueControl<string | null>, FormFieldControl, DatePickerHost {
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

  /** date-fns format of the string value. Defaults to the `DATE_FORMAT` token. */
  public valueFormat = input<string | undefined>(undefined);
  /** date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('P');
  public locale = input<Locale | null>(null);

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);

  public pickerOpen = model(false);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** The current value as a `Date` (what the picker calendar binds to). */
  public date = computed(() => {
    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });
  });

  /** The committed value rendered in `displayFormat`. */
  public displayValue = computed(() => {
    const date = this.date();

    if (date === null) {
      return '';
    }

    return formatDateValue(date, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /** Uncommitted field text — kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse against `displayFormat`. */
  public parseError = signal(false);

  public focused = signal(false);
  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_INPUT);

  /** @internal */
  public registeredField = signal<DateInputFieldDirective | null>(null);
  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());
  public hasValue = computed(() => this.value() !== null || this.inputText().length > 0);
  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);
  public describedById = computed(() => this.describedBy());

  private overlay = createDatePickerOverlay({
    interactive: this.interactive,
    pickerOpen: this.pickerOpen,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    context: () => ({ $implicit: this, close: () => this.closePicker() }),
    onAfterClosed: (byOutsidePointer) => {
      // focus fell to <body> with the pane's removal — hand it back to the field,
      // except for outside closes (the user deliberately went elsewhere)
      if (!byOutsidePointer && this.document.activeElement === this.document.body) {
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
   * @internal Commits typed field text: empty clears, a strict `displayFormat`
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

    const parsed = parseDateValue(raw, { format: this.displayFormat(), locale: this.effectiveLocale() });

    if (parsed === null) {
      this.inputText.set(raw);
      this.parseError.set(true);

      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(parsed, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
  }

  /** Commits a picker-selected date and closes the picker. */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(date, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.touched.set(true);
    this.closePicker();
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
