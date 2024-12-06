import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SlideToggleImports } from '../../slide-toggle.imports';

@Component({
  selector: 'et-sb-slide-toggle',
  template: `
    <et-slide-toggle-field [formControl]="fg">
      <et-slide-toggle />
      <et-label>Slide it</et-label>
    </et-slide-toggle-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SlideToggleImports, ReactiveFormsModule],
})
export class StorybookSlideToggleComponent {
  fg = new FormControl(false);
}
