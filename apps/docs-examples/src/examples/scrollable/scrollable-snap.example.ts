import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-scrollable-snap-example',
  template: `
    <et-scrollable etScrollableDrag etScrollableSnap scrollMode="element">
      @for (item of ITEMS; track item) {
        <div class="example-scrollable-snap-item" etAutoSurface>{{ item }}</div>
      }
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-scrollable-snap-item {
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
    }

    .et-scrollable-container {
      gap: 12px;
    }
  `,
})
export class ScrollableSnapExampleComponent {
  protected readonly ITEMS = Array.from({ length: 7 }, (_, index) => `Item ${index}`);
}
