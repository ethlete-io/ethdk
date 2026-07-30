import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
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
import { Locale } from 'date-fns';
import { FORM_FIELD_TOKEN, FormFieldControl, FormFieldControlType } from '../../form-field/headless';
import { injectDateLocale } from '../date-time-formats';
import { DatePickerHost, DatePickerSurfaceBase, DatePickerTriggerBase } from '../picker/date-picker-host';
import { createDatePickerOverlay } from './date-picker-overlay';
import { maskPatternFromDisplayFormat } from './display-format-mask';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';

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
@Directive({
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export abstract class DatePickerInputDirective
  implements FormValueControl<string | null>, FormFieldControl, DatePickerHost
{
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private document = inject(DOCUMENT);
  public defaultLocale = injectDateLocale();

  /** date-fns wire format used when `valueFormat` is unset — the token differs per control. */
  protected abstract defaultValueFormat: string;
  /** The form-field control-type tag (date-input / time-input / date-time-input). */
  public abstract controlType: Signal<FormFieldControlType>;
  /**
   * The date-fns format in effect for the field — declared per control. Usually its own
   * `displayFormat` input; the date input derives one from `precision` when that is unset.
   */
  public abstract effectiveDisplayFormat: Signal<string>;
  /** The committed value rendered in `displayFormat` — computed per control from its own value conversion. */
  public abstract displayValue: Signal<string>;

  /**
   * @internal Commits typed field text: empty clears, a successful parse writes
   * the value, anything else keeps the raw text and raises `parseError`. The
   * parse rules (strict vs lenient) are the subclasses'.
   */
  public abstract commitInput(raw: string): void;

  /** The wire value in `valueFormat`, or `null` while empty/unparseable. */
  public value = model<string | null>(null);
  /** View state for a field whose source values disagree (bulk edit). The raw form value stays untouched. */
  public mixed = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public placeholder = input('');
  /**
   * Field placeholder shown while `mixed` is set. Presentation only — a masked
   * date field cannot render arbitrary text, so the field stays empty and the
   * label shows through the placeholder slot; it never enters the form value.
   */
  public mixedLabel = input<string | null>(null);

  /** date-fns format of the string value. Defaults to the control's format token. */
  public valueFormat = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);

  /**
   * Opt-in typing mask: when `displayFormat` is fixed-width numeric (`dd.MM.yyyy`,
   * `HH:mm`), typing gets guide placeholders (`__.__.____`), auto-inserted
   * separators, and paste filtering. Formats the mask cannot represent — locale
   * formats like the defaults `P`/`p`/`Pp`, variable-width or text tokens — are
   * refused and typing stays unmasked. Commit parsing is identical either way:
   * the lenient blur/Enter parsers stay authoritative.
   */
  public mask = input(false, { transform: booleanAttribute });

  public pickerOpen = model(false);

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** Uncommitted field text — kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse. */
  public parseError = signal(false);

  public focused = signal(false);
  /** @internal Keeps the form field in its focused style while the picker overlay is open. */
  public expanded = computed(() => this.pickerOpen());
  public describedBy = signal<string | null>(null);

  /** @internal */
  public registeredField = signal<DatePickerInputFieldBase | null>(null);
  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerBase | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceBase | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());
  public hasValue = computed(() => this.mixed() || this.value() !== null || this.inputText().length > 0);
  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  /** What the field renders as its placeholder — `mixedLabel` while mixed masks the value. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** The `[etInputMask]` pattern derived from the format in effect — `null` while `mask` is off or the format is refused. */
  public maskPattern = computed(() =>
    this.mask() ? maskPatternFromDisplayFormat(this.effectiveDisplayFormat()) : null,
  );

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

    if (ngDevMode) {
      // a refused format silently behaving like `mask: false` would be a head-scratcher
      effect(() => {
        if (this.mask() && this.maskPattern() === null) {
          console.warn(
            `[et-${this.controlType()}] displayFormat "${this.effectiveDisplayFormat()}" is not fixed-width numeric, so no typing mask can be derived — the mask input is ignored.`,
          );
        }
      });
    }
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus();
  }

  /** Clears the value and any uncommitted field text — wired to the styled inputs' clear button. */
  public clearValue() {
    if (!this.interactive()) {
      return;
    }

    this.value.set(null);
    this.mixed.set(false);
    this.inputText.set('');
    this.parseError.set(false);

    // the field only mirrors state while unfocused (mid-typing rewrites would fight the
    // caret) — a clear happens while focused, so reset the element text directly
    const field = this.registeredField();

    if (field) {
      field.elementRef.nativeElement.value = '';
    }
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
  public resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.registeredField()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }
}
