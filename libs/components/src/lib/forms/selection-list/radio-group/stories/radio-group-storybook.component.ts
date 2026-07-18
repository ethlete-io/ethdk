import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FormFieldSize, HintComponent, LabelDirective } from '../../../form-field';
import { RadioGroupComponent } from '../radio-group.component';
import { RadioComponent } from '../radio.component';

@Component({
  selector: 'et-sb-radio-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-radio-group [formField]="demoForm.color" [size]="size()">
        <et-label>{{ label() }}</et-label>

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
  imports: [RadioGroupComponent, RadioComponent, FormField, ProvideColorDirective, HintComponent, LabelDirective],
})
export class RadioGroupStorybookComponent {
  public label = input('Favorite color');
  public hint = input('');
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public color = input('brand');
  public size = input<FormFieldSize>('md');

  public options = input([
    { value: 'red', label: 'Red' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
  ]);

  private formModel = linkedSignal(() => ({ color: null as string | null }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.color, { when: () => this.required(), message: 'Please select a color' });
  });
}
