import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LabelComponent, SliderImports } from '../../..';

@Component({
  selector: 'et-sb-slider',
  template: `
    <et-slider-field [formControl]="fg">
      <et-label>Slider</et-label>
      <et-slider [min]="min || 0" [max]="max || 100" [step]="step || 1" />
    </et-slider-field>

    <et-slider-field [formControl]="fg">
      <et-label>Slider Inverted</et-label>
      <et-slider [min]="min || 0" [max]="max || 100" [step]="step || 1" inverted />
    </et-slider-field>

    <br />
    <br />

    <et-slider-field [formControl]="fg">
      <et-label> Slider Vertical</et-label>
      <et-slider [min]="min || 0" [max]="max || 100" [step]="step || 1" vertical />
    </et-slider-field>

    <et-slider-field [formControl]="fg">
      <et-label> Slider Vertical Inverted</et-label>
      <et-slider [min]="min || 0" [max]="max || 100" [step]="step || 1" vertical inverted />
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

  min = 0;
  max = 100;
  step = 1;
}
