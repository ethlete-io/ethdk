import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { LabelDirective } from '../../form-field';
import { HintComponent } from '../../form-field/hint.component';
import { RangeSliderValue } from '../headless';
import { SLIDER_IMPORTS } from '../slider.imports';

@Component({
  selector: 'et-sb-range-slider',
  template: `
    <div [etProvideColor]="color()" [attr.dir]="direction() || null" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-range-slider
        [(mixed)]="mixedState"
        [formField]="demoForm.value"
        [mixedLabel]="mixedLabel()"
        [minValue]="minValue()"
        [maxValue]="maxValue()"
        [step]="step()"
        [minDistance]="minDistance()"
        [startLabel]="startLabel()"
        [endLabel]="endLabel()"
      >
        <et-label>{{ label() }}</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
        @if (showValueLabel()) {
          <ng-template etSliderThumbLabel let-value>{{ value }}</ng-template>
        }
      </et-range-slider>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.value().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      } @else {
        <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SLIDER_IMPORTS, LabelDirective, HintComponent, FormField, ProvideColorDirective, JsonPipe],
})
export class RangeSliderStorybookComponent {
  public label = input('Price range');
  public hint = input('');
  public value = input<RangeSliderValue>([20, 80]);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public minValue = input(0);
  public maxValue = input(100);
  public step = input(1);
  public minDistance = input(0);
  public startLabel = input('Minimum');
  public endLabel = input('Maximum');
  public disabled = input(false);
  public readonly = input(false);
  public showValueLabel = input(false);
  public color = input('brand');
  public direction = input('');

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
  });
}
