import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { GRID_TOKEN } from './grid.tokens';

@Directive({
  selector: '[etGridItem]',
  exportAs: 'etGridItem',
  host: {
    class: 'et-grid-item',
    '[style.grid-column]': 'gridColumn()',
    '[style.grid-row]': 'gridRow()',
  },
})
export class GridItemDirective {
  private grid = inject(GRID_TOKEN);
  public hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  public itemId = input.required<string>();
  public minColSpan = input(1, { transform: numberAttribute });
  public maxColSpan = input(12, { transform: numberAttribute });
  public minRowSpan = input(1, { transform: numberAttribute });
  public maxRowSpan = input(4, { transform: numberAttribute });

  public isBeingDragged = computed(() => this.grid.dragState()?.itemId === this.itemId());
  private frozenPosition = signal<{ col: number; row: number; colSpan: number; rowSpan: number } | null>(null);

  public currentPosition = computed(() => {
    const layout = this.grid.layout();
    const entry = layout.find((e) => e.id === this.itemId());
    return entry?.position ?? null;
  });

  public renderPosition = computed(() => {
    const frozen = this.frozenPosition();

    if (frozen && this.isBeingDragged()) {
      return frozen;
    }

    return this.currentPosition();
  });

  public currentCol = computed(() => this.renderPosition()?.col ?? 0);
  public currentRow = computed(() => this.renderPosition()?.row ?? 0);
  public currentColSpan = computed(() => this.renderPosition()?.colSpan ?? 1);
  public currentRowSpan = computed(() => this.renderPosition()?.rowSpan ?? 1);

  protected gridColumn = computed(() => `${this.currentCol() + 1} / span ${this.currentColSpan()}`);
  protected gridRow = computed(() => `${this.currentRow() + 1} / span ${this.currentRowSpan()}`);

  constructor() {
    effect((onCleanup) => {
      const id = this.itemId();
      const el = this.hostElement.nativeElement;
      this.grid.registerItem(id, {
        el,
        constraints: {
          minColSpan: this.minColSpan(),
          maxColSpan: this.maxColSpan(),
          minRowSpan: this.minRowSpan(),
          maxRowSpan: this.maxRowSpan(),
        },
      });
      onCleanup(() => this.grid.unregisterItem(id));
    });

    effect(() => {
      const drag = this.grid.dragState();

      untracked(() => {
        if (drag?.itemId === this.itemId()) {
          const pos = this.currentPosition();

          if (pos && !this.frozenPosition()) {
            this.frozenPosition.set(pos);
          }
        } else {
          this.frozenPosition.set(null);
        }
      });
    });
  }
}
