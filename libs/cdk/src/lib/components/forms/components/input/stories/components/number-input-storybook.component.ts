import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-number-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-number-input [min]="min()" [max]="max()" />
      <et-label>Number input</et-label>
    </et-input-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookNumberInputComponent {
  fg = new FormControl();

  readonly min = input<string | null>(null);

  readonly max = input<string | null>(null);
}
