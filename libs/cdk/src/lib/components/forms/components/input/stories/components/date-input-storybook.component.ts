import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-date-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-date-input />
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
}
