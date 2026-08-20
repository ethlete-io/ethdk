import { Component, ViewEncapsulation, booleanAttribute, input, numberAttribute } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { ScrollbarOrientation } from '../headless/scrollbar.types';
import { SCROLLBAR_IMPORTS } from '../scrollbar.imports';

@Component({
  selector: 'et-sb-scrollbar',
  template: `
    <div [style.max-inline-size.px]="560" class="p-8 font-sans">
      @if (orientation() === 'vertical') {
        <div class="relative">
          <div #container class="flex h-64 flex-col gap-2 overflow-y-auto pr-6">
            @for (row of ROWS; track row) {
              <div
                class="text-medium rounded-lg p-4"
                style="background: var(--et-surface-background-solid)"
                etAutoSurface
              >
                {{ row }}
              </div>
            }
          </div>

          <et-scrollbar
            [for]="container"
            [autoHide]="autoHide()"
            [minThumbSize]="minThumbSize()"
            [disabled]="disabled()"
          />
        </div>
      } @else {
        <div class="relative">
          <div #container class="flex gap-2 overflow-x-auto pb-6">
            @for (card of CARDS; track card) {
              <div
                class="text-medium grid h-32 w-40 shrink-0 place-items-center rounded-lg"
                style="background: var(--et-surface-background-solid)"
                etAutoSurface
              >
                {{ card }}
              </div>
            }
          </div>

          <et-scrollbar
            [for]="container"
            [autoHide]="autoHide()"
            [minThumbSize]="minThumbSize()"
            [disabled]="disabled()"
            orientation="horizontal"
          />
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS, AutoSurfaceDirective],
})
export class ScrollbarStorybookComponent {
  public orientation = input<ScrollbarOrientation>('vertical');
  public autoHide = input(false, { transform: booleanAttribute });
  public minThumbSize = input(24, { transform: numberAttribute });
  public disabled = input(false, { transform: booleanAttribute });

  protected readonly ROWS = Array.from({ length: 24 }, (_, index) => `Row ${index + 1}`);
  protected readonly CARDS = Array.from({ length: 14 }, (_, index) => `Card ${index + 1}`);
}
