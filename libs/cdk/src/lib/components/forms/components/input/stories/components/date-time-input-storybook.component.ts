import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-date-time-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-date-time-input [min]="min()" [max]="max()">
        <button etInputSuffix etShowPickerTrigger type="button">Show picker directive</button>
      </et-date-time-input>
      <et-label>Date Time input</et-label>
    </et-input-field>

    <p>{{ fg.value }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookDateTimeInputComponent {
  fg = new FormControl();

  readonly min = input<string | null>(null);

  readonly max = input<string | null>(null);
}
