import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SliderImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-slider-example',
  template: `
    <et-slider-field [formControl]="volume">
      <et-label>Slider</et-label>
      <et-slider [min]="0" [max]="100" [step]="1" renderValueTooltip />
    </et-slider-field>

    <et-slider-field [formControl]="volume">
      <et-label>Slider with thumb content</et-label>
      <et-slider [min]="0" [max]="100" [step]="1">
        <ng-template etSliderThumbContentTemplate>
          <p>{{ volume.value }}</p>
        </ng-template>
      </et-slider>
    </et-slider-field>

    <et-slider-field [formControl]="volume">
      <et-label>Slider inverted</et-label>
      <et-slider [min]="0" [max]="100" [step]="1" inverted />
    </et-slider-field>

    <et-slider-field [formControl]="volume">
      <et-label>Slider vertical</et-label>
      <et-slider [min]="0" [max]="100" [step]="1" vertical />
    </et-slider-field>

    <pre>{{ volume.value | json }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SliderImports, ReactiveFormsModule, JsonPipe],
})
export class CdkSliderExampleComponent {
  public volume = new FormControl(40);
}
