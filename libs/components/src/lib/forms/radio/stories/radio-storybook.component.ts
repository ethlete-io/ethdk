import { ChangeDetectionStrategy, Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { HintComponent } from '../../form-field';
import { RadioGroupComponent, RadioGroupLabelDirective } from '../../radio-group';
import { RADIO_IMPORTS } from '../radio.imports';

@Component({
  selector: 'et-sb-form-field-radio',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-radio-group [formField]="demoForm.color">
        <et-radio-group-label>{{ label() }}</et-radio-group-label>

        @for (option of options(); track option.value) {
          <et-radio [value]="option.value">{{ option.label }}</et-radio>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-radio-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...RADIO_IMPORTS,
    RadioGroupComponent,
    RadioGroupLabelDirective,
    FormField,
    ProvideColorDirective,
    HintComponent,
  ],
})
export class FormFieldRadioStorybookComponent {
  public label = input('Favorite color');
  public hint = input('');
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  public options = input([
    { value: 'red', label: 'Red' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
  ]);

  private formModel = linkedSignal(() => ({ color: null as string | null }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.color, { when: () => this.required(), message: 'Please select a color' });
  });
}
