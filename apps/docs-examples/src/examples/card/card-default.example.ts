import { Component, ViewEncapsulation } from '@angular/core';
import { CARD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-card-default-example',
  template: `
    <et-card class="example-card" variant="outlined">
      <h3>Revenue</h3>
      <p>$12,400 this month</p>
    </et-card>

    <et-card class="example-card" variant="outlined" surface="dark-elevated">
      <h3>On an elevated surface</h3>
      <p>The card provides its own surface scope.</p>
    </et-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
  styles: `
    .example-card {
      --et-card-padding: 20px;
      inline-size: 240px;
    }
  `,
})
export class CardDefaultExampleComponent {}
