import { computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { INPUT_TEXT_ALIGNMENTS, InputTextAlignment } from '../input.types';

export const INPUT_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PASSWORD: 'password',
  TEL: 'tel',
  URL: 'url',
  SEARCH: 'search',
} as const;

type InputType = (typeof INPUT_TYPES)[keyof typeof INPUT_TYPES];

@Directive({
  selector: '[etInput]',
})
export class InputDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  // FormValueControl — bound by [formField]
  public value = model('');
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  // Own inputs
  public type = input<InputType>(INPUT_TYPES.TEXT);
  public placeholder = input('');
  public autocomplete = input('');
  public textAlign = input<InputTextAlignment>(INPUT_TEXT_ALIGNMENTS.START);

  // Computed
  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  // Form field integration
  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  public describedById = computed(() => this.describedBy());

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    if (this.disabled()) return;

    this.focusTarget()?.focus();
  }
}
