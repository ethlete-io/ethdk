import { JsonPipe } from '@angular/common';
import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { DescriptionComponent } from '../../../description';
import { FormFieldSize, HintComponent, LabelDirective } from '../../../form-field';
import { SelectionListOrientation } from '../../selection-list.types';
import { RadioGroupComponent } from '../radio-group.component';
import { RadioComponent, RadioVariant } from '../radio.component';

@Component({
  selector: 'et-sb-radio-group',
  template: `
    <!-- Frame width in px, not Tailwind's rem-based max-w-* scale: this playground runs a 62.5% root
         font, which shrinks max-w-md to ~280px and would make the horizontal row wrap after two
         options regardless of how much room a real app has. -->
    <div
      [style.max-inline-size.px]="orientation() === 'horizontal' ? 560 : 448"
      [etProvideColor]="color()"
      class="flex flex-col gap-4 p-8 font-sans"
    >
      <et-radio-group [(mixed)]="mixedState" [formField]="demoForm.color" [size]="size()" [orientation]="orientation()">
        <et-label>{{ label() }}</et-label>

        @for (option of options(); track option.value) {
          <et-radio [value]="option.value" [variant]="variant()">
            {{ option.label }}
            @if (variant() === 'card' && option.description) {
              <et-description>{{ option.description }}</et-description>
            }
          </et-radio>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-radio-group>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.color().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    RadioGroupComponent,
    RadioComponent,
    FormField,
    JsonPipe,
    ProvideColorDirective,
    HintComponent,
    LabelDirective,
    DescriptionComponent,
  ],
})
export class RadioGroupStorybookComponent {
  public label = input('Favorite color');
  public orientation = input<SelectionListOrientation>('vertical');
  public hint = input('');
  public value = input<string | null>(null);
  public mixed = input(false);
  public showMixedState = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public color = input('brand');
  public size = input<FormFieldSize>('md');
  public variant = input<RadioVariant>('plain');

  public options = input<{ value: string; label: string; description?: string }[]>([
    { value: 'red', label: 'Red', description: 'Warm, and hard to miss.' },
    { value: 'green', label: 'Green', description: 'Calm, and easy on the eyes.' },
    { value: 'blue', label: 'Blue', description: 'Cool, and the default nearly everywhere.' },
  ]);

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ color: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.color, { when: () => this.required(), message: 'Please select a color' });
  });
}
