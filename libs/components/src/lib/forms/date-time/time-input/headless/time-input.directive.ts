import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { Locale, startOfDay } from 'date-fns';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { injectDateLocale, injectTimeFormat } from '../../date-time-formats';
import { createDatePickerOverlay } from '../../internals/date-picker-overlay';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_PICKER_HOST, DatePickerHost } from '../../picker/date-picker-host';
import { DatePickerSurfaceDirective } from '../../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../../picker/date-picker-trigger.directive';
import { parseTimeText } from './internals/time-parse';
import { TimeInputFieldDirective } from './time-input-field.directive';

/**
 * A time form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, `HH:mm` by default). Typed entry parses leniently on blur/Enter
 * (`930` → 09:30); the anchored picker overlay hosts a time picker and stays
 * open across part picks. String↔`Date` conversion happens exclusively here —
 * the time picker itself only ever sees `Date` objects.
 */
@Directive({
  selector: '[etTimeInput]',
  exportAs: 'etTimeInput',
  providers: [{ provide: DATE_PICKER_HOST, useExisting: TimeInputDirective }],
})
export class TimeInputDirective implements FormValueControl<string | null>, FormFieldControl, DatePickerHost {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private defaultValueFormat = injectTimeFormat();
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

  /** date-fns format of the string value. Defaults to the `TIME_FORMAT` token. */
  public valueFormat = input<string | undefined>(undefined);
  /** date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('p');
  public locale = input<Locale | null>(null);

  public pickerOpen = model(false);

  // parses fill missing units (the date, unentered seconds) from here instead of "now"
  private referenceDate = startOfDay(new Date());

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** The current value as a `Date` (what the picker binds to). */
  public time = computed(() => {
    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, {
      format: this.effectiveValueFormat(),
      locale: this.effectiveLocale(),
      referenceDate: this.referenceDate,
    });
  });

  /** The committed value rendered in `displayFormat`. */
  public displayValue = computed(() => {
    const time = this.time();

    if (time === null) {
      return '';
    }

    return formatDateValue(time, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /** Uncommitted field text — kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse, even leniently. */
  public parseError = signal(false);

  public focused = signal(false);
  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TIME_INPUT);

  /** @internal */
  public registeredField = signal<TimeInputFieldDirective | null>(null);
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

    const parsed = parseTimeText(raw, {
      format: this.displayFormat(),
      locale: this.effectiveLocale(),
      referenceDate: this.referenceDate,
    });

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

  /**
   * Commits a picker-selected time. The picker stays open — picking a time
   * takes one selection per column.
   */
  public selectTime(time: Date | null) {
    if (time === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(time, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.touched.set(true);
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
