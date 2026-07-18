import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, Signal, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { Locale } from 'date-fns';
import { FORM_FIELD_TOKEN, FormFieldControl, FormFieldControlType } from '../../form-field/headless';
import { injectDateLocale } from '../date-time-formats';
import { DatePickerHost, DatePickerSurfaceBase, DatePickerTriggerBase } from '../picker/date-picker-host';
import { createDatePickerOverlay } from './date-picker-overlay';

/** The registered text field a date-picker input focuses and anchors to. */
export type DatePickerInputFieldBase = { focus(): void; elementRef: ElementRef<HTMLInputElement> };

/**
 * Shared host for the three `Date`-string picker inputs (`et-date-input`, `et-time-input`,
 * `et-date-time-input`). They copy-pasted the same plumbing verbatim: the standard control
 * inputs, the picker overlay wiring + open/close/toggle, the `interactive`/`hasValue`/
 * `shouldDisplayError`/`labelId` computeds, the field/trigger/surface registration, and the
 * form-field registration. Subclasses add their own `value`↔`Date` conversion, `displayFormat`,
 * `controlType`, `defaultValueFormat`, commit/select logic, and (date + date-time) the calendar
 * bounds. Must be extended by an `@Directive` — Angular only surfaces inherited inputs from a
 * decorated base.
 */
@Directive()
export abstract class DatePickerInputDirective
  implements FormValueControl<string | null>, FormFieldControl, DatePickerHost
{
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private document = inject(DOCUMENT);
  protected defaultLocale = injectDateLocale();

  /** date-fns wire format used when `valueFormat` is unset — the token differs per control. */
  protected abstract defaultValueFormat: string;
  /** The form-field control-type tag (date-input / time-input / date-time-input). */
  public abstract controlType: Signal<FormFieldControlType>;

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

  /** date-fns format of the string value. Defaults to the control's format token. */
  public valueFormat = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);

  public pickerOpen = model(false);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** Uncommitted field text — kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse. */
  public parseError = signal(false);

  public focused = signal(false);
  public describedBy = signal<string | null>(null);

  /** @internal */
  public registeredField = signal<DatePickerInputFieldBase | null>(null);
  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerBase | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceBase | null>(null);

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
      // focus fell to <body> with the pane's removal — hand it back to the field, except for
      // outside closes (the user deliberately went elsewhere) and bottom-sheet closes
      // (refocusing would pop the soft keyboard)
      if (!byOutsidePointer && !fromBottomSheet && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.formField?.registerControl(this);
    destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
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

  // the field is the anchor inside a form field so the panel lines up with the visible box
  protected resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.registeredField()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }
}
