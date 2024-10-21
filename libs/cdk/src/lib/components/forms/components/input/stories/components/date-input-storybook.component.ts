import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-date-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-date-input [min]="min" [max]="max" />
      <et-label>Date input</et-label>
    </et-input-field>

    <p>{{ fg.value }}</p>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookDateInputComponent {
  fg = new FormControl();

  @Input()
  min: string | null = null;

  @Input()
  max: string | null = null;
}
