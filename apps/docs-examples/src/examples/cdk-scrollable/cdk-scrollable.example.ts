import { Component, viewChild, ViewEncapsulation } from '@angular/core';
import { ScrollableComponent, ScrollableImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-scrollable-example',
  template: `
    <button (click)="scrollToIndex(4)" type="button">Scroll to index 4</button>

    <et-scrollable itemSize="auto" scrollMode="element" renderNavigation>
      @for (item of items; track item) {
        <button [etScrollableIsActiveChild]="item === 4" class="example-scrollable-item" type="button">
          {{ item }}
        </button>
      }
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollableImports],
  styles: `
    .example-scrollable-item {
      min-inline-size: 200px;
      block-size: 100px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
    }

    .et-scrollable-container {
      block-size: 100px;
      gap: 20px;
    }
  `,
})
export class CdkScrollableExampleComponent {
  public scrollable = viewChild.required(ScrollableComponent);

  public items = [0, 1, 2, 3, 4, 5, 6];

  public scrollToIndex(index: number) {
    this.scrollable().scrollToElementByIndex({ index });
  }
}
