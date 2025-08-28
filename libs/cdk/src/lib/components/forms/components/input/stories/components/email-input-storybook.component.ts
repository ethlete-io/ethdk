import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-email-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-email-input />
      <et-label>Email input</et-label>
    </et-input-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookEmailInputComponent {
  fg = new FormControl();
}
