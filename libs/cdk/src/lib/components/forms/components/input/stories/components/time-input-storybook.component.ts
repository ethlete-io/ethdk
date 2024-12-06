import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-time-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-time-input />
      <et-label>Time input</et-label>
    </et-input-field>

    <p>{{ fg.value }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookTimeInputComponent {
  fg = new FormControl('10:00');
}
