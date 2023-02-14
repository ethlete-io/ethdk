import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LabelComponent, SliderImports } from '../../..';

@Component({
  selector: 'et-sb-slider',
  template: `
    <et-slider-field [formControl]="fg">
      <et-label>Slider</et-label>
      <et-slider />
    </et-slider-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SliderImports, LabelComponent, ReactiveFormsModule, JsonPipe],
})
export class StorybookSliderComponent {
  fg = new FormControl(null);
}
