import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { SCROLLBAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-scrollbar-both-axes-and-rtl-example',
  template: `
    <section class="example-scrollbar-section">
      <h2>Both axes</h2>

      <div class="example-scrollbar-frame">
        <div #grid class="example-scrollbar-grid">
          @for (row of GRID_ROWS; track $index) {
            <div class="example-scrollbar-grid-row">
              @for (cell of row; track cell) {
                <div class="example-scrollbar-cell" etAutoSurface>{{ cell }}</div>
              }
            </div>
          }
        </div>

        <et-scrollbar [for]="grid" autoHide />
        <et-scrollbar [for]="grid" orientation="horizontal" autoHide />
      </div>
    </section>

    <section class="example-scrollbar-section">
      <h2>Right to left</h2>

      <div class="example-scrollbar-frame" dir="rtl">
        <div #rtlTrack class="example-scrollbar-track">
          @for (card of RTL_CARDS; track card) {
            <div class="example-scrollbar-cell" etAutoSurface>{{ card }}</div>
          }
        </div>

        <et-scrollbar [for]="rtlTrack" orientation="horizontal" />
      </div>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-scrollbar-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-inline-size: 560px;
      margin-block-end: 32px;
    }

    .example-scrollbar-section h2 {
      margin: 0;
      font-size: 1.6rem;
    }

    .example-scrollbar-frame {
      position: relative;
    }

    .example-scrollbar-grid {
      block-size: 256px;
      padding-inline-end: 24px;
      padding-block-end: 24px;
      overflow: auto;
    }

    .example-scrollbar-grid-row {
      display: flex;
      gap: 8px;
      margin-block-end: 8px;
    }

    .example-scrollbar-track {
      display: flex;
      gap: 8px;
      padding-block-end: 24px;
      overflow-x: auto;
    }

    .example-scrollbar-cell {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      inline-size: 128px;
      block-size: 64px;
      border-radius: 8px;
      background: var(--et-surface-background-solid);
    }
  `,
})
export class ScrollbarBothAxesAndRtlExampleComponent {
  protected readonly GRID_ROWS = Array.from({ length: 14 }, (_, row) =>
    Array.from({ length: 10 }, (_, column) => `R${row + 1}C${column + 1}`),
  );

  protected readonly RTL_CARDS = Array.from({ length: 14 }, (_, index) => `بطاقة ${index + 1}`);
}
