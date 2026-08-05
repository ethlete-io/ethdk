import { afterNextRender, computed, Directive, effect, signal } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { FORM_FIELD_ERROR_CODES } from './form-field-errors';
import {
  CounterComponentBase,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
  FormFieldDirectiveBase,
  HintComponentBase,
  LabelDirectiveBase,
} from './form-field.tokens';

let uniqueIdCounter = 0;

@Directive({
  selector: '[etFormField]',
  providers: [{ provide: FORM_FIELD_TOKEN, useExisting: FormFieldDirective }],
})
export class FormFieldDirective implements FormFieldDirectiveBase {
  private readonly hostElement = injectHostElement();

  /** @internal */
  public registeredControl = signal<FormFieldControl | null>(null);

  /** @internal */
  public registeredHint = signal<HintComponentBase | null>(null);

  /** @internal */
  public registeredCounter = signal<CounterComponentBase | null>(null);

  /** @internal */
  public registeredLabel = signal<LabelDirectiveBase | null>(null);

  /** Set by the form-field component; read by overlay-based controls (e.g. the select) as their anchor. */
  public controlFrameElement = signal<HTMLElement | null>(null);

  private readonly FALLBACK_ID = `ff-${uniqueIdCounter++}`;

  public errorId = computed(() => {
    const ctrl = this.registeredControl();
    const name = ctrl?.name();

    return name ? `et-form-field-error-${name}` : `et-form-field-error-${this.FALLBACK_ID}`;
  });

  public hintId = computed(() => {
    const ctrl = this.registeredControl();
    const name = ctrl?.name();

    return name ? `et-form-field-hint-${name}` : `et-form-field-hint-${this.FALLBACK_ID}`;
  });

  public shouldDisplayError = computed(() => {
    const ctrl = this.registeredControl();

    if (!ctrl) {
      return false;
    }

    // a committed-but-unparseable value is an error too - otherwise the native input reads
    // `aria-invalid` (it gates on the control's parse error) while the field shows no message
    return ctrl.touched() && (ctrl.invalid() || (ctrl.parseError?.() ?? false));
  });

  public errors = computed(() => this.registeredControl()?.errors() ?? []);

  /** Whether the registered control is currently reporting an unparseable committed value. */
  public parseError = computed(() => this.registeredControl()?.parseError?.() ?? false);

  /** The control's parse-error message (shown when there's a parse error but no validation error). */
  public parseErrorMessage = computed(() => this.registeredControl()?.resolvedParseErrorMessage?.() ?? null);

  public controlType = computed(() => this.registeredControl()?.controlType() ?? FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);

  /** The registered control's value - the counter measures this. */
  public controlValue = computed<unknown>(() => this.registeredControl()?.value?.() ?? null);

  /** The bound field's schema `maxLength()`, when signal forms bound one into the control. */
  public controlMaxLength = computed(() => this.registeredControl()?.maxLength?.());

  /** Whether an async validator is currently in flight for the bound field. */
  public isPending = computed(() => this.registeredControl()?.pending?.() ?? false);

  public focused = computed(() => this.registeredControl()?.focused?.() ?? false);

  /** Whether the registered control's popup (picker/select/cascader panel) is open. */
  public expanded = computed(() => this.registeredControl()?.expanded?.() ?? false);

  public hasValue = computed(() => this.registeredControl()?.hasValue?.() ?? false);

  public isReadonly = computed(() => this.registeredControl()?.readonly?.() ?? false);

  public isDisabled = computed(() => this.registeredControl()?.disabled?.() ?? false);

  /** Whether the control reports itself hidden (signal-forms schema) - hides the whole field. */
  public isHidden = computed(() => this.registeredControl()?.hidden?.() ?? false);

  public usesTextFieldShell = computed(
    () =>
      this.controlType() === FORM_FIELD_CONTROL_TYPES.TEXT_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.NUMBER_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.PASSWORD_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.COLOR_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.TEXTAREA ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.RICH_TEXT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.SELECT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.CASCADER ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.TAG_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.PHONE_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.DATE_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.DATE_RANGE_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.TIME_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.DATE_TIME_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.DURATION_INPUT,
  );

  public shouldFloatLabel = computed(() => this.focused() || this.expanded() || this.hasValue());

  public describedById = computed(() => {
    if (this.shouldDisplayError() && (this.errors().length > 0 || this.parseError())) {
      return this.errorId();
    }

    if (this.registeredHint()) {
      return this.hintId();
    }

    return null;
  });

  constructor() {
    effect(() => {
      const control = this.registeredControl();

      if (!control) {
        return;
      }

      control.describedBy.set(this.describedById());
    });

    if (ngDevMode) {
      afterNextRender(() => {
        const control = this.registeredControl();

        if (!control) {
          throw new RuntimeError(
            FORM_FIELD_ERROR_CODES.MISSING_CONTROL,
            '[FormFieldDirective] No form control found. Add <et-input> or <et-checkbox> inside <et-form-field>.',
            { element: this.hostElement },
          );
        }

        if (!this.registeredLabel() && !(control.hasCustomAccessibleName?.() ?? false)) {
          throw new RuntimeError(
            FORM_FIELD_ERROR_CODES.MISSING_LABEL,
            '[FormFieldDirective] The control has no accessible name. Project an <et-label> into the ' +
              '<et-form-field>, or set aria-label / aria-labelledby on the control. A placeholder is not ' +
              'an accessible name.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /** @internal */
  public registerControl(control: FormFieldControl) {
    const previousControl = this.registeredControl();

    if (previousControl === control) {
      return;
    }

    previousControl?.describedBy.set(null);
    this.registeredControl.set(control);
  }

  /** @internal */
  public unregisterControl(control: FormFieldControl) {
    if (this.registeredControl() === control) {
      control.describedBy.set(null);
      this.registeredControl.set(null);
    }
  }

  /** @internal */
  public registerHint(hint: HintComponentBase) {
    if (this.registeredHint() === hint) {
      return;
    }

    this.registeredHint.set(hint);
  }

  /** @internal */
  public unregisterHint(hint: HintComponentBase) {
    if (this.registeredHint() === hint) {
      this.registeredHint.set(null);
    }
  }

  /** @internal */
  public registerCounter(counter: CounterComponentBase) {
    if (this.registeredCounter() === counter) {
      return;
    }

    this.registeredCounter.set(counter);
  }

  /** @internal */
  public unregisterCounter(counter: CounterComponentBase) {
    if (this.registeredCounter() === counter) {
      this.registeredCounter.set(null);
    }
  }

  /** @internal */
  public unregisterLabel(label: LabelDirectiveBase) {
    if (this.registeredLabel() === label) {
      this.registeredLabel.set(null);
    }
  }

  public activate() {
    this.registeredControl()?.activate();
  }
}
