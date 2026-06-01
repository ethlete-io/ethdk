import { ChangeDetectionStrategy, Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { HintComponent } from '../../../form-field';
import { CheckboxGroupComponent } from '../checkbox-group.component';
import { CheckboxOptionComponent } from '../checkbox-option.component';

@Component({
  selector: 'et-sb-checkbox-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-checkbox-group [formField]="demoForm.toppings">
        <span class="et-checkbox-group-label">{{ label() }}</span>

        @for (option of options(); track option.value) {
          <et-checkbox-option [value]="option.value">{{ option.label }}</et-checkbox-option>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-checkbox-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxGroupComponent, CheckboxOptionComponent, FormField, ProvideColorDirective, HintComponent],
})
export class CheckboxGroupStorybookComponent {
  public label = input('Select toppings');
  public hint = input('');
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  public options = input([
    { value: 'cheese', label: 'Cheese' },
    { value: 'pepperoni', label: 'Pepperoni' },
    { value: 'mushrooms', label: 'Mushrooms' },
  ]);

  private formModel = linkedSignal(() => ({ toppings: [] as string[] }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.toppings, { when: () => this.required(), message: 'Please select at least one' });
  });
}
