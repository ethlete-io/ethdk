import { Component, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { SCROLLBAR_IMPORTS } from '../scrollbar.imports';

@Component({
  selector: 'et-sb-scrollbar-axes',
  template: `
    <div [style.max-inline-size.px]="560" class="flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-2">
        <h2 class="text-h6">Both axes</h2>

        <div class="relative">
          <div #grid class="h-64 overflow-auto pr-6 pb-6">
            <div class="flex flex-col gap-2">
              @for (row of GRID_ROWS; track $index) {
                <div class="flex gap-2">
                  @for (cell of row; track cell) {
                    <div
                      class="text-medium grid h-16 w-32 shrink-0 place-items-center rounded-lg"
                      style="background: var(--et-surface-background-solid)"
                      etAutoSurface
                    >
                      {{ cell }}
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <et-scrollbar [for]="grid" autoHide />
          <et-scrollbar [for]="grid" orientation="horizontal" autoHide />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-h6">Right to left</h2>

        <div class="relative" dir="rtl">
          <div #rtlTrack class="flex gap-2 overflow-x-auto pb-6">
            @for (card of RTL_CARDS; track card) {
              <div
                class="text-medium grid h-24 w-40 shrink-0 place-items-center rounded-lg"
                style="background: var(--et-surface-background-solid)"
                etAutoSurface
              >
                {{ card }}
              </div>
            }
          </div>

          <et-scrollbar [for]="rtlTrack" orientation="horizontal" />
        </div>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS, AutoSurfaceDirective],
})
export class ScrollbarAxesStorybookComponent {
  protected readonly GRID_ROWS = Array.from({ length: 14 }, (_, row) =>
    Array.from({ length: 10 }, (_, column) => `R${row + 1}C${column + 1}`),
  );

  protected readonly RTL_CARDS = Array.from({ length: 14 }, (_, index) => `بطاقة ${index + 1}`);
}
