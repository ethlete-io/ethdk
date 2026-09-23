import { DOCUMENT } from '@angular/common';
import {
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
import { ValidationError } from '@angular/forms/signals';
import { Locale } from 'date-fns';
import { AccessibleNameControlDirective, FORM_FIELD_TOKEN, FormFieldControlType } from '../../form-field/headless';
import { mountControlSuffixStyles } from '../../form-field/form-field-control-suffix-styles.component';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { injectDateLocale } from '../date-time-formats';
import { DatePickerHost, DatePickerSurfaceBase, DatePickerTriggerBase } from '../picker/date-picker-host';
import { createDatePickerOverlay } from './date-picker-overlay';
import { maskPatternFromDisplayFormat } from './display-format-mask';

/** The registered text field a date-picker input focuses and anchors to. */
export type DatePickerInputFieldBase = {
  focus(options?: FocusOptions): void;
  /**
   * Blanks the field text, including an attached mask's own copy of it - the field only mirrors
   * control state while unfocused and a mask owns the element text, so a clear has to reach both.
   */
  resetText(): void;
  elementRef: ElementRef<HTMLInputElement>;
};

/**
 * Shared host for every picker input, single and range: the standard control inputs, the picker
 * overlay and the trigger/surface registration.
 *
 * Must be extended by an `@Directive` - Angular only surfaces inherited inputs from a decorated base.
 */
@Directive({
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export abstract class PickerInputBaseDirective extends AccessibleNameControlDirective implements DatePickerHost {
  private formFieldLabels = injectFormFieldLabels();
  private document = inject(DOCUMENT);

  protected formField = inject(FORM_FIELD_TOKEN, { optional: true });

  public defaultLocale = injectDateLocale();

  /** date-fns wire format used when `valueFormat` is unset - the token differs per control. */
  protected abstract defaultValueFormat: string;
  /** The form-field control-type tag. */
  public abstract controlType: Signal<FormFieldControlType>;
  /** The date-fns format in effect for the field(s) - declared per control. */
  public abstract effectiveDisplayFormat: Signal<string>;
  /** `true` while a field holds text that does not parse. */
  public abstract parseError: Signal<boolean>;

  protected abstract readonly KEEPS_FOCUS_ON_FOCUS_LEAVE: boolean;

  /**
   * View state for a field whose source values disagree (bulk edit). The raw form value stays
   * untouched; on a range one flag masks both sides.
   */
  public mixed = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  /**
   * Field placeholder shown while `mixed` is set. Presentation only - it never enters the form
   * value.
   */
  public mixedLabel = input<string | null>(null);

  /** date-fns format of the string value. Defaults to the control's format token. */
  public valueFormat = input<string | undefined>(undefined);
  public locale = input<Locale | null>(null);

  /**
   * Opt-in typing mask: when `displayFormat` is fixed-width numeric (`dd.MM.yyyy`,
   * `HH:mm`), typing gets guide placeholders (`__.__.____`), auto-inserted
   * separators, and paste filtering. Formats the mask cannot represent - locale
   * formats like the defaults `P`/`p`/`Pp`, variable-width or text tokens - are
   * refused and typing stays unmasked.
   */
  public mask = input(false, { transform: booleanAttribute });

  public pickerOpen = model(false);

  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  public describedBy = signal<string | null>(null);

  /**
   * @internal Ids the control contributes to `aria-describedby` itself, on top of the one the form
   * field sets.
   */
  public ownDescribedBy: Signal<string | null> = signal(null);

  /** @internal Everything the field's `aria-describedby` must point at, in reading order. */
  public describedByIds = computed(() => {
    const ids = [this.describedBy(), this.ownDescribedBy()].filter((id): id is string => id !== null && id !== '');

    return ids.length > 0 ? ids.join(' ') : null;
  });

  /** @internal Keeps the form field in its focused style while the picker overlay is open. */
  public expanded = computed(() => this.pickerOpen());

  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerBase | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceBase | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());
  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  /** The `[etInputMask]` pattern derived from the format in effect - `null` while `mask` is off or the format is refused. */
  public maskPattern = computed(() =>
    this.mask() ? maskPatternFromDisplayFormat(this.effectiveDisplayFormat()) : null,
  );

  private overlay = createDatePickerOverlay({
    interactive: this.interactive,
    pickerOpen: this.pickerOpen,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    context: () => ({ $implicit: this, close: () => this.closePicker() }),
    onAfterClosed: ({ byOutsidePointer, byFocusLeave, fromBottomSheet }) => {
      if (
        !byOutsidePointer &&
        !(byFocusLeave && this.KEEPS_FOCUS_ON_FOCUS_LEAVE) &&
        !fromBottomSheet &&
        this.document.activeElement === this.document.body
      ) {
        this.activate();
      }
    },
  });

  constructor() {
    super();

    mountTextFieldShellStyles();
    mountControlSuffixStyles();

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

  public abstract focus(options?: FocusOptions): void;

  protected abstract anchorField(): DatePickerInputFieldBase | null;

  public activate() {
    this.focus();
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

  public resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.anchorField()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }
}
