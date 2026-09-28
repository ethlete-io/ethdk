import { afterNextRender, computed, contentChildren, Directive, effect, inject, signal } from '@angular/core';
import { FORM_FIELD } from '@angular/forms/signals';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { FIELD_WARNINGS, FieldWarning, toFieldWarnings } from './field-warnings';
import { FORM_FIELD_ERROR_CODES } from './form-field-errors';
import {
  ControlSuffixBase,
  CounterComponentBase,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
  FormFieldControlType,
  FormFieldDirectiveBase,
  HintComponentBase,
  LabelDirectiveBase,
} from './form-field.tokens';

let uniqueIdCounter = 0;

const TEXT_FIELD_SHELL_CONTROL_TYPES: ReadonlySet<FormFieldControlType> = /* @__PURE__ */ new Set([
  FORM_FIELD_CONTROL_TYPES.TEXT_INPUT,
  FORM_FIELD_CONTROL_TYPES.NUMBER_INPUT,
  FORM_FIELD_CONTROL_TYPES.PASSWORD_INPUT,
  FORM_FIELD_CONTROL_TYPES.COLOR_INPUT,
  FORM_FIELD_CONTROL_TYPES.TEXTAREA,
  FORM_FIELD_CONTROL_TYPES.RICH_TEXT,
  FORM_FIELD_CONTROL_TYPES.SELECT,
  FORM_FIELD_CONTROL_TYPES.CASCADER,
  FORM_FIELD_CONTROL_TYPES.TAG_INPUT,
  FORM_FIELD_CONTROL_TYPES.PHONE_INPUT,
  FORM_FIELD_CONTROL_TYPES.DATE_INPUT,
  FORM_FIELD_CONTROL_TYPES.DATE_RANGE_INPUT,
  FORM_FIELD_CONTROL_TYPES.TIME_INPUT,
  FORM_FIELD_CONTROL_TYPES.TIME_RANGE_INPUT,
  FORM_FIELD_CONTROL_TYPES.DATE_TIME_INPUT,
  FORM_FIELD_CONTROL_TYPES.DATE_TIME_RANGE_INPUT,
  FORM_FIELD_CONTROL_TYPES.DURATION_INPUT,
]);

const tagOf = (element: HTMLElement) => `<${element.tagName.toLowerCase()}>`;

@Directive({
  selector: '[etFormField]',
  providers: [{ provide: FORM_FIELD_TOKEN, useExisting: FormFieldDirective }],
})
export class FormFieldDirective implements FormFieldDirectiveBase {
  /** The field's own element, chrome included - what scrolling to this field targets. */
  public element = injectHostElement();

  // `self` matters - without it an outer `[formField]` binding would leak in.
  private ownFieldBinding = inject(FORM_FIELD, { optional: true, self: true });
  private outerField = inject(FORM_FIELD_TOKEN, { optional: true, skipSelf: true });
  private wrappedFieldBindings = contentChildren(FORM_FIELD, { descendants: true });
  private nestedFields = contentChildren(FORM_FIELD_TOKEN, { descendants: true });

  /** @internal */
  public registeredControl = signal<FormFieldControl | null>(null);

  /** @internal */
  public registeredHint = signal<HintComponentBase | null>(null);

  /** @internal */
  public registeredCounter = signal<CounterComponentBase | null>(null);

  /** @internal */
  public registeredLabel = signal<LabelDirectiveBase | null>(null);

  /** @internal */
  public registeredControlSuffix = signal<ControlSuffixBase | null>(null);

  /**
   * The control's own in-field affordances (clear button, picker trigger, reveal toggle). A custom field
   * chrome renders it with `ngTemplateOutlet` in its suffix slot.
   */
  public controlSuffixTemplate = computed(() => this.registeredControlSuffix()?.templateRef ?? null);

  /** Set by the form-field component; read by overlay-based controls (e.g. the select) as their anchor. */
  public controlFrameElement = signal<HTMLElement | null>(null);

  private readonly ID_SUFFIX = `ff-${uniqueIdCounter++}`;

  public errorId = computed(() => `et-form-field-error-${this.ID_SUFFIX}`);

  public hintId = computed(() => `et-form-field-hint-${this.ID_SUFFIX}`);

  public warningId = computed(() => `et-form-field-warning-${this.ID_SUFFIX}`);

  /**
   * The non-blocking advisories to show under the field: what the bound field's `warn()` rules
   * produced, plus what the registered control was given through its own `warnings` input. They
   * never touch validity.
   */
  public warnings = computed<readonly FieldWarning[]>(() => {
    const bindings = this.ownFieldBinding
      ? [this.ownFieldBinding, ...this.wrappedFieldBindings()]
      : this.wrappedFieldBindings();

    return [
      ...bindings.flatMap((binding) => binding.state().metadata(FIELD_WARNINGS)?.() ?? []),
      ...toFieldWarnings(this.registeredControl()?.warnings?.() ?? null),
    ];
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

  /** The registered control's value. */
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

  public usesTextFieldShell = computed(() => TEXT_FIELD_SHELL_CONTROL_TYPES.has(this.controlType()));

  public shouldFloatLabel = computed(() => this.focused() || this.expanded() || this.hasValue());

  /** Whether the field is showing an error message. */
  public displaysErrorMessage = computed(
    () => this.shouldDisplayError() && (this.errors().length > 0 || this.parseError()),
  );

  /** Whether a warning is the message the field shows: it has one, and no error is taking the slot. */
  public displaysWarning = computed(() => !this.displaysErrorMessage() && this.warnings().length > 0);

  /** @internal The id of an `<et-description>` the field's chrome renders, set by that chrome. */
  public descriptionId = signal<string | null>(null);

  private supportMessageId = computed(() => {
    if (this.displaysErrorMessage()) {
      return this.errorId();
    }

    if (this.displaysWarning()) {
      return this.warningId();
    }

    if (this.registeredHint()) {
      return this.hintId();
    }

    return null;
  });

  /** Every id the control's `aria-describedby` points at, space-separated, in reading order. */
  public describedById = computed(() => {
    const ids = [this.descriptionId(), this.supportMessageId()].filter((id) => id !== null);

    return ids.length > 0 ? ids.join(' ') : null;
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

        const nestedField = this.nestedFields()[0];

        if (!control) {
          throw new RuntimeError(
            FORM_FIELD_ERROR_CODES.MISSING_CONTROL,
            nestedField
              ? `[FormFieldDirective] No form control found. ${tagOf(nestedField.element)} is a field of its own: ` +
                  `remove the ${tagOf(this.element)} around it and project the <et-label> and <et-hint> into it.`
              : '[FormFieldDirective] No form control found. Add <et-input> or <et-checkbox> inside <et-form-field>.',
            { element: this.element },
          );
        }

        if (!this.registeredLabel() && !(control.hasCustomAccessibleName?.() ?? false)) {
          throw new RuntimeError(
            FORM_FIELD_ERROR_CODES.MISSING_LABEL,
            this.outerField
              ? `[FormFieldDirective] The control has no accessible name. ${tagOf(this.element)} sits inside ` +
                  `another field (${tagOf(this.outerField.element)}), whose <et-label> does not reach it: move the ` +
                  `<et-label> into ${tagOf(this.element)}, or set aria-label / aria-labelledby on it.`
              : '[FormFieldDirective] The control has no accessible name. Project an <et-label> into the ' +
                  '<et-form-field>, or set aria-label / aria-labelledby on the control. A placeholder is not ' +
                  'an accessible name.',
            { element: this.element },
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
