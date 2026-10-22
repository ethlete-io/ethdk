import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { SCROLLBAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-scrollbar-default-example',
  template: `
    <div class="example-scrollbar-frame">
      <div #container class="example-scrollbar-list">
        @for (row of ROWS; track row) {
          <div class="example-scrollbar-row" etAutoSurface>{{ row }}</div>
        }
      </div>

      <et-scrollbar [for]="container" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-scrollbar-frame {
      position: relative;
      max-inline-size: 560px;
    }

    .example-scrollbar-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      block-size: 256px;
      padding-inline-end: 24px;
      overflow-y: auto;
    }

    .example-scrollbar-row {
      padding: 16px;
      border-radius: 8px;
      background: var(--et-surface-background-solid);
    }
  `,
})
export class ScrollbarDefaultExampleComponent {
  protected readonly ROWS = Array.from({ length: 24 }, (_, index) => `Row ${index + 1}`);
}
