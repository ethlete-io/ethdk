import { JsonPipe } from '@angular/common';
import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { DescriptionComponent } from '../../../description';
import { FormFieldSize, HintComponent, LabelDirective } from '../../../form-field';
import { CheckboxGroupSelectAllComponent } from '../checkbox-group-select-all.component';
import { CheckboxGroupComponent } from '../checkbox-group.component';
import { CheckboxOptionComponent, CheckboxOptionVariant } from '../checkbox-option.component';
import { SelectionListOrientation } from '../../selection-list.types';

@Component({
  selector: 'et-sb-checkbox-group',
  template: `
    <!-- Frame width in px, not Tailwind's rem-based max-w-* scale: Storybook runs a 62.5% root
         font, which shrinks max-w-md to ~280px and would make the horizontal row wrap after two
         options regardless of how much room a real app has. -->
    <div
      [style.max-inline-size.px]="orientation() === 'horizontal' ? 560 : 448"
      [etProvideColor]="color()"
      class="flex flex-col gap-4 p-8 font-sans"
    >
      <et-checkbox-group
        [(mixed)]="mixedState"
        [formField]="demoForm.toppings"
        [size]="size()"
        [orientation]="orientation()"
      >
        <et-label>{{ label() }}</et-label>

        @if (groupControl()) {
          <!-- The prebuilt select-all row: the tri-state logic and the mixed mark come with it, so the
               demo no longer hand-rolls either. -->
          <et-checkbox-group-select-all />
        }

        @for (option of options(); track option.value) {
          <et-checkbox-option [value]="option.value" [variant]="variant()">
            {{ option.label }}
            @if (variant() === 'card' && option.description) {
              <et-description>{{ option.description }}</et-description>
            }
          </et-checkbox-option>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-checkbox-group>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.toppings().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CheckboxGroupComponent,
    CheckboxGroupSelectAllComponent,
    CheckboxOptionComponent,
    FormField,
    JsonPipe,
    ProvideColorDirective,
    HintComponent,
    LabelDirective,
    DescriptionComponent,
  ],
})
export class CheckboxGroupStorybookComponent {
  public label = input('Select toppings');
  public orientation = input<SelectionListOrientation>('vertical');
  public hint = input('');
  public value = input<string[]>([]);
  public mixed = input(false);
  public showMixedState = input(false);
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');
  public size = input<FormFieldSize>('md');
  public groupControl = input(false);
  public variant = input<CheckboxOptionVariant>('plain');
  public readonly = input(false);

  public options = input<{ value: string; label: string; description?: string }[]>([
    { value: 'cheese', label: 'Cheese', description: 'Mozzarella, and plenty of it.' },
    { value: 'pepperoni', label: 'Pepperoni', description: 'Spicy, and the house favourite.' },
    { value: 'mushrooms', label: 'Mushrooms', description: 'Chestnut, sliced thin.' },
  ]);

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ toppings: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.toppings, { when: () => this.required(), message: 'Please select at least one' });
  });
}
