import { afterNextRender, computed, Directive, effect, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { FORM_FIELD_ERROR_CODES } from './form-field-errors';
import {
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
  /** @internal */
  public registeredControl = signal<FormFieldControl | null>(null);

  /** @internal */
  public registeredHint = signal<HintComponentBase | null>(null);

  /** @internal */
  public registeredLabel = signal<LabelDirectiveBase | null>(null);

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

    return ctrl.touched() && ctrl.invalid();
  });

  public errors = computed(() => this.registeredControl()?.errors() ?? []);

  public controlType = computed(() => this.registeredControl()?.controlType() ?? FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);

  public focused = computed(() => this.registeredControl()?.focused?.() ?? false);

  public hasValue = computed(() => this.registeredControl()?.hasValue?.() ?? false);

  public usesTextFieldShell = computed(
    () =>
      this.controlType() === FORM_FIELD_CONTROL_TYPES.TEXT_INPUT ||
      this.controlType() === FORM_FIELD_CONTROL_TYPES.RICH_TEXT,
  );

  public shouldFloatLabel = computed(() => this.focused() || this.hasValue());

  public describedById = computed(() => {
    if (this.shouldDisplayError() && this.errors().length > 0) {
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
        if (!this.registeredControl()) {
          throw new RuntimeError(
            FORM_FIELD_ERROR_CODES.MISSING_CONTROL,
            '[FormFieldDirective] No form control found. Add <et-input> or <et-checkbox> inside <et-form-field>.',
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
  public unregisterLabel(label: LabelDirectiveBase) {
    if (this.registeredLabel() === label) {
      this.registeredLabel.set(null);
    }
  }

  public activate() {
    this.registeredControl()?.activate();
  }
}
