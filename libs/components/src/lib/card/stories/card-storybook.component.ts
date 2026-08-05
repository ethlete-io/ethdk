import { Component, ViewEncapsulation, input } from '@angular/core';
import { CardVariant } from '../card.component';
import { CARD_IMPORTS } from '../card.imports';

@Component({
  selector: 'et-sb-card',
  template: `
    <div class="flex flex-wrap items-start gap-4 p-8 font-sans">
      <et-card [variant]="variant()" style="--et-card-padding: 20px; inline-size: 240px">
        <h3 class="text-medium m-0">Revenue</h3>
        <p class="text-medium m-0 opacity-70">$12,400 this month</p>
      </et-card>

      <et-card [variant]="variant()" surface="dark-elevated" style="--et-card-padding: 20px; inline-size: 240px">
        <h3 class="text-medium m-0">On an elevated surface</h3>
        <p class="text-medium m-0 opacity-70">The card provides its own surface scope.</p>
      </et-card>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class CardStorybookComponent {
  public variant = input<CardVariant>('outlined');
}
