import {
  Directive,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { signalHostStyles } from '@ethlete/core';
import { GRID_TOKEN } from './grid.tokens';

@Directive({
  selector: '[etGridItem]',
  exportAs: 'etGridItem',
  host: {
    class: 'et-grid-item',
  },
})
export class GridItemDirective {
  private grid = inject(GRID_TOKEN);
  public hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  // --- Inputs ---

  public itemId = input.required<string>();
  public minColSpan = input(1, { transform: numberAttribute });
  public maxColSpan = input(12, { transform: numberAttribute });
  public minRowSpan = input(1, { transform: numberAttribute });
  public maxRowSpan = input(4, { transform: numberAttribute });

  // --- Drag state ---

  public isBeingDragged = computed(() => this.grid.dragState()?.itemId === this.itemId());
  private frozenPosition = signal<{ col: number; row: number; colSpan: number; rowSpan: number } | null>(null);

  // --- Derived ---

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

  // --- Host style bindings ---

  public hostStyles = signalHostStyles({
    'grid-column': computed(() => `${this.currentCol() + 1} / span ${this.currentColSpan()}`),
    'grid-row': computed(() => `${this.currentRow() + 1} / span ${this.currentRowSpan()}`),
  });

  constructor() {
    // Register element for FLIP animations
    effect((onCleanup) => {
      const id = this.itemId();
      const el = this.hostElement.nativeElement;
      this.grid.itemElements.set(id, el);
      onCleanup(() => this.grid.itemElements.delete(id));
    });

    let lastPosStr = '';
    effect(() => {
      const pos = this.renderPosition();
      const isDragged = this.isBeingDragged();
      const dragActive = !!this.grid.dragState();
      const posStr = JSON.stringify(pos);

      if (posStr !== lastPosStr) {
        lastPosStr = posStr;
        console.log('[GRID-ITEM] position CHANGED', {
          id: untracked(() => this.itemId()),
          pos,
          isDragged,
          dragActive,
        });
      }
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
