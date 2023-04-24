import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports, LabelComponent } from '../../..';

@Component({
  selector: 'et-sb-email-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-email-input />
      <et-label>Email input</et-label>
    </et-input-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, LabelComponent, ReactiveFormsModule],
})
export class StorybookEmailInputComponent {
  fg = new FormControl();
}
