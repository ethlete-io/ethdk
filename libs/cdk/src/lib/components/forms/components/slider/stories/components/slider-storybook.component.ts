import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SliderImports } from '../../slider.imports';

@Component({
  selector: 'et-sb-slider',
  template: `
    <et-slider-field [formControl]="fg">
      <et-label>Slider</et-label>
      <et-slider [min]="min || 0" [max]="max || 100" [step]="step || 1" [renderValueTooltip]="renderValueTooltip" />
    </et-slider-field>

    <et-slider-field [formControl]="fg">
      <et-label>Slider Inverted</et-label>
      <et-slider
        [min]="min || 0"
        [max]="max || 100"
        [step]="step || 1"
        [renderValueTooltip]="renderValueTooltip"
        inverted
      />
    </et-slider-field>

    <br />
    <br />

    <et-slider-field [formControl]="fg">
      <et-label> Slider Vertical</et-label>
      <et-slider
        [min]="min || 0"
        [max]="max || 100"
        [step]="step || 1"
        [renderValueTooltip]="renderValueTooltip"
        vertical
      />
    </et-slider-field>

    <et-slider-field [formControl]="fg">
      <et-label> Slider Vertical Inverted</et-label>
      <et-slider
        [min]="min || 0"
        [max]="max || 100"
        [step]="step || 1"
        [renderValueTooltip]="renderValueTooltip"
        vertical
        inverted
      />
    </et-slider-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SliderImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookSliderComponent {
  fg = new FormControl(null);

  min = 0;
  max = 100;
  step = 1;
  renderValueTooltip = false;
}
