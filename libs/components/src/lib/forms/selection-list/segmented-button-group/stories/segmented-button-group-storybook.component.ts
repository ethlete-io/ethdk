import { JsonPipe } from '@angular/common';
import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FormFieldSize, HintComponent, LabelDirective } from '../../../form-field';
import { SegmentedButtonGroupComponent, SegmentedButtonGroupVariant } from '../segmented-button-group.component';
import { SegmentedButtonComponent } from '../segmented-button.component';

@Component({
  selector: 'et-sb-segmented-button-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-segmented-button-group
        [(mixed)]="mixedState"
        [variant]="variant()"
        [formField]="demoForm.viewMode"
        [size]="size()"
      >
        <et-label>{{ label() }}</et-label>

        @for (option of options(); track option.value) {
          <et-segmented-button [value]="option.value">{{ option.label }}</et-segmented-button>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-segmented-button-group>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.viewMode().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    SegmentedButtonGroupComponent,
    SegmentedButtonComponent,
    FormField,
    JsonPipe,
    ProvideColorDirective,
    HintComponent,
    LabelDirective,
  ],
})
export class SegmentedButtonGroupStorybookComponent {
  public label = input('View mode');
  public hint = input('');
  public value = input<string | null>('list');
  public mixed = input(false);
  public showMixedState = input(false);
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');
  public variant = input<SegmentedButtonGroupVariant>('pill');
  public size = input<FormFieldSize>('md');

  public options = input([
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'table', label: 'Table' },
  ]);

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ viewMode: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.viewMode, { when: () => this.required(), message: 'Please select a view mode' });
  });
}
