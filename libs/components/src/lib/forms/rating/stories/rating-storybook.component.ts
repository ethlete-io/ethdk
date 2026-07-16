import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { LabelDirective } from '../../form-field';
import { HintComponent } from '../../form-field/hint.component';
import { RATING_IMPORTS } from '../rating.imports';

@Component({
  selector: 'et-sb-rating',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-rating [formField]="demoForm.value" [max]="max()" [allowHalf]="allowHalf()">
        <et-label>{{ label() }}</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-rating>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() ?? 'null' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...RATING_IMPORTS, LabelDirective, HintComponent, FormField, ProvideColorDirective],
})
export class RatingStorybookComponent {
  public label = input('Rating');
  public hint = input('');
  public value = input<number | null>(null);
  public max = input(5);
  public allowHalf = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public color = input('brand');

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
    required(s.value, { when: () => this.required(), message: 'Please pick a rating' });
  });
}
