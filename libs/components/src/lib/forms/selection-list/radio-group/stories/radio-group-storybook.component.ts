import { JsonPipe } from '@angular/common';
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
      <et-radio-group [(mixed)]="mixedState" [formField]="demoForm.color" [size]="size()">
        <et-label>{{ label() }}</et-label>

        @for (option of options(); track option.value) {
          <et-radio [value]="option.value">{{ option.label }}</et-radio>
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
  ],
})
export class RadioGroupStorybookComponent {
  public label = input('Favorite color');
  public hint = input('');
  public value = input<string | null>(null);
  public mixed = input(false);
  public showMixedState = input(false);
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

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ color: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.color, { when: () => this.required(), message: 'Please select a color' });
  });
}
