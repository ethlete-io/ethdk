import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { injectLocale, signalHostStyles } from '@ethlete/core';
import { injectGridConfig } from './headless/grid-config';
import { GridDirective } from './headless/grid.directive';

@Component({
  selector: 'et-grid, [et-grid]',
  template: `
    <ng-content />
    @if (grid.ghostPosition(); as ghost) {
      <div
        #ghostRef
        [style.grid-column]="ghost.col + 1 + ' / span ' + ghost.colSpan"
        [style.grid-row]="ghost.row + 1 + ' / span ' + ghost.rowSpan"
        class="et-grid-ghost"
      ></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: GridDirective,
      inputs: ['breakpoints', 'rowHeight', 'gap', 'initialItems', 'readOnly'],
      outputs: ['layoutChange'],
    },
  ],
  host: {
    class: 'et-grid',
    role: 'region',
    '[attr.aria-label]': 'ariaLabel()',
  },
  styles: `
    @property --et-grid-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-grid-row-height {
      syntax: '<length>';
      inherits: false;
      initial-value: 100px;
    }

    @property --et-grid-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 0px;
    }

    .et-grid {
      display: grid;
      grid-template-columns: repeat(var(--_et-grid-columns, 12), 1fr);
      grid-auto-rows: var(--et-grid-row-height);
      gap: var(--et-grid-gap);
      padding: var(--et-grid-padding);
      position: relative;
      min-height: 0;

      &:has(.et-grid-item--dragging, .et-grid-item--resizing) {
        user-select: none;
        cursor: grabbing;
      }

      &:has(.et-grid-item--resizing) {
        cursor: nwse-resize;
      }
    }

    .et-grid-ghost {
      border-radius: 8px;
      background: rgb(var(--et-surface-color, 23 23 23) / 0.08);
      border: 2px dashed rgb(var(--et-surface-color, 23 23 23) / 0.2);
      pointer-events: none;
      transition:
        grid-column 0s,
        grid-row 0s;
    }

    .et-grid--readonly {
      .et-grid-item__drag-handle {
        cursor: default;
        pointer-events: none;
      }

      .et-grid-item__actions {
        display: none;
      }

      .et-grid-item:hover {
        .et-resize-handle--e::after,
        .et-resize-handle--s::after,
        .et-resize-handle--w::after,
        .et-resize-handle--n::after,
        .et-resize-handle--se::after,
        .et-resize-handle--sw::after,
        .et-resize-handle--ne::after,
        .et-resize-handle--nw::after {
          content: unset;
        }
      }
    }
  `,
})
export class GridComponent {
  public grid = inject(GridDirective);
  private ghostRef = viewChild<ElementRef<HTMLElement>>('ghostRef');
  private gridConfig = injectGridConfig();
  private locale = injectLocale();

  protected ariaLabel = computed(() => {
    const label = this.grid.readOnly() ? this.gridConfig.readonlyAriaLabel : this.gridConfig.interactiveAriaLabel;
    return this.gridConfig.transformer(label, this.locale.currentLocale());
  });

  public hostStyles = signalHostStyles({
    '--_et-grid-columns': computed(() => `${this.grid.activeColumns()}`),
    '--et-grid-gap': computed(() => `${this.grid.gap()}px`),
    '--et-grid-row-height': computed(() => `${this.grid.rowHeight()}px`),
  });

  constructor() {
    effect(() => {
      this.grid.setGhostElement(this.ghostRef()?.nativeElement ?? null);
    });
  }
}
