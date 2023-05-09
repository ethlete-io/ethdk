import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../..';

@Component({
  selector: 'et-sb-number-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-number-input />
      <et-label>Number input</et-label>
    </et-input-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookNumberInputComponent {
  fg = new FormControl();
}
