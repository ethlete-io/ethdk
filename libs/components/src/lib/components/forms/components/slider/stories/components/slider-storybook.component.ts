import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LabelComponent, SliderImports } from '../../..';

@Component({
  selector: 'et-sb-slider',
  template: `
    <et-slider-field>
      <et-label>Slider</et-label>
      <et-slider>
        <input [formControl]="fg" etSliderThumb />
      </et-slider>
    </et-slider-field>

    <pre> {{ fg.value | json }} </pre>

    <et-slider-field [formControl]="fg">
      <et-label>Range Slider</et-label>
      <et-slider>
        <input etSliderStartThumb />
        <input etSliderEndThumb />
      </et-slider>
    </et-slider-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SliderImports, LabelComponent, ReactiveFormsModule, JsonPipe],
})
export class StorybookSliderComponent {
  fg = new FormControl(null);
}
