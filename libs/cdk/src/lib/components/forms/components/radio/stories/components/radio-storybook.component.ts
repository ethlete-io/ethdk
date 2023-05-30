import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RadioImports } from '../../..';

@Component({
  selector: 'et-sb-radio',
  template: `
    <et-radio-group [formControl]="fg">
      <et-radio-field>
        <et-label>Radio 1 </et-label>
        <et-radio value="1" />
      </et-radio-field>

      <et-radio-field>
        <et-label>Radio 2 </et-label>
        <et-radio value="2" />
      </et-radio-field>

      <et-radio-field>
        <et-label>Radio 3 </et-label>
        <et-radio value="3" />
      </et-radio-field>
    </et-radio-group>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RadioImports, ReactiveFormsModule],
})
export class StorybookRadioComponent {
  fg = new FormControl('1');
}
