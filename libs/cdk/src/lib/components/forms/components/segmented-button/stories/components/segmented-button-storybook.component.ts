import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SegmentedButtonImports } from '../../segmented-button.imports';

@Component({
  selector: 'et-sb-segmented-button',
  template: `
    <et-segmented-button-group [formControl]="fg">
      <et-segmented-button-field>
        <et-segmented-button value="1">Value 1</et-segmented-button>
      </et-segmented-button-field>

      <et-segmented-button-field>
        <et-segmented-button value="2">segmented-button 2</et-segmented-button>
      </et-segmented-button-field>

      <et-segmented-button-field>
        <et-segmented-button value="3" disabled>num 3</et-segmented-button>
      </et-segmented-button-field>
    </et-segmented-button-group>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SegmentedButtonImports, ReactiveFormsModule],
})
export class StorybookSegmentedButtonComponent {
  fg = new FormControl('1');
}
