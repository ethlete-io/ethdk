import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RadioImports } from '../../radio.imports';

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

    <br /><br />

    <et-radio-group [formControl]="fg2">
      <et-radio-card-field>
        <et-label>Radio 1 </et-label>
        <et-radio value="1" />
      </et-radio-card-field>

      <br />

      <et-radio-card-field>
        <et-label>Radio 2 </et-label>
        <et-radio value="2" />
      </et-radio-card-field>

      <br />

      <et-radio-card-field>
        <et-label>Radio 3 </et-label>
        <et-radio value="3" />
      </et-radio-card-field>
    </et-radio-group>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RadioImports, ReactiveFormsModule],
})
export class StorybookRadioComponent {
  fg = new FormControl('1');
  fg2 = new FormControl('1');
}
