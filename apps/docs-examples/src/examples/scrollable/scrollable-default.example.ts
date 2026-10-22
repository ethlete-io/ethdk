import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-scrollable-default-example',
  template: `
    <et-scrollable etScrollableDrag etScrollableNavigation>
      @for (item of ITEMS; track item.index) {
        <button [etScrollableActiveChild]="item.active" class="example-scrollable-item" etAutoSurface>
          {{ item.label }}
        </button>
      }
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-scrollable-item {
      display: flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 200px;
      block-size: 100%;
      min-block-size: 80px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
      font-weight: 600;
      cursor: pointer;
    }

    .et-scrollable-container {
      gap: 12px;
    }
  `,
})
export class ScrollableDefaultExampleComponent {
  protected readonly ITEMS = Array.from({ length: 7 }, (_, index) => ({
    index,
    label: `Item ${index}`,
    active: index === 3 || index === 4,
  }));
}
