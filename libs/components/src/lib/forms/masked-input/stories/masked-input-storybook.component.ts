import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { INPUT_IMPORTS } from '../../input/input.imports';
import { MaskSpec, MaskValueMode } from '../headless';
import { MASKED_INPUT_IMPORTS } from '../masked-input.imports';
import { createCardMask } from '../masks/card-mask';
import { createCurrencyMask } from '../masks/currency-mask';
import { createIbanMask } from '../masks/iban-mask';

export const MASK_PRESETS = {
  PATTERN: 'pattern',
  CURRENCY: 'currency',
  IBAN: 'iban',
  CARD: 'card',
} as const;

export type MaskPreset = (typeof MASK_PRESETS)[keyof typeof MASK_PRESETS];

@Component({
  selector: 'et-sb-masked-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-input
          [formField]="demoForm.value"
          [etInputMask]="resolvedMask()"
          [maskValueMode]="maskValueMode()"
          [placeholderChar]="placeholderChar() || null"
          [placeholder]="placeholder()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: "{{ demoForm.value().value() }}"</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, ...MASKED_INPUT_IMPORTS, FormField, ProvideColorDirective],
})
export class MaskedInputStorybookComponent {
  public label = input('Masked input');
  public hint = input('');
  public placeholder = input('');
  public preset = input<MaskPreset>(MASK_PRESETS.PATTERN);
  public pattern = input('00-00-0000');
  public placeholderChar = input('');
  public maskValueMode = input<MaskValueMode>('raw');
  public value = input('');
  public color = input('brand');

  protected resolvedMask = computed<string | MaskSpec>(() => {
    switch (this.preset()) {
      case MASK_PRESETS.CURRENCY:
        return createCurrencyMask({ suffix: ' €' });
      case MASK_PRESETS.IBAN:
        return createIbanMask();
      case MASK_PRESETS.CARD:
        return createCardMask();
      default:
        return this.pattern();
    }
  });

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel);
}
