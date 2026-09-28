import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { DragHandleDirective } from '@ethlete/core';
import { TableColumnMeta } from './headless/table-features';
import { TableResizeDirective } from './table-resize.directive';

/**
 * The grip at one header cell's trailing edge, stamped there by `etTableResize`: a focusable
 * `role="separator"` that a pointer drags and the keyboard steps.
 *
 * Its own `etDragHandle` swallows the pointerdown, so grabbing the grip resizes instead of starting a
 * header reorder when both features are used together. This is where the drag primitives are actually
 * referenced; it reaches the feature by DI through the injector the feature registered with.
 *
 * @internal
 */
@Component({
  selector: 'et-table-resize-grip',
  template: `
    <span
      [attr.aria-label]="labels().resizeColumn(column().header ?? column().key)"
      [attr.aria-valuenow]="valueNow()"
      [attr.aria-valuemin]="bounds()?.min"
      [attr.aria-valuemax]="valueMax()"
      (dragStarted)="resize.start(column())"
      (dragMoved)="resize.update($event)"
      (dragEnded)="resize.end()"
      (dragCancelled)="resize.cancel()"
      (dblclick)="reset()"
      (focus)="measure()"
      (keydown)="handleKeydown($event)"
      class="et-table-resize-grip"
      etDragHandle
      role="separator"
      aria-orientation="vertical"
      tabindex="0"
    ></span>
  `,
  styleUrl: './table-resize-grip.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [DragHandleDirective],
})
export class TableResizeGripComponent {
  protected resize = inject(TableResizeDirective);
  private injector = inject(Injector);

  /** The column this grip resizes. Set by the table (see {@link TableHeaderAdornment}). */
  public column = input.required<TableColumnMeta>();

  protected labels = this.resize.table.resolvedLabels;

  protected bounds = signal<{ now: number; min: number; max: number } | null>(null);

  protected valueNow = computed(() => this.resize.table.columnWidths()[this.column().key] ?? this.bounds()?.now);
  protected valueMax = computed(() => {
    const max = this.bounds()?.max;

    return max !== undefined && Number.isFinite(max) ? max : null;
  });

  constructor() {
    this.measureAfterRender();
  }

  protected measure() {
    this.bounds.set(this.resize.widthOf(this.column()));
  }

  protected reset() {
    this.resize.reset(this.column());
    this.measureAfterRender();
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (!this.resize.resizeByKey(this.column(), event)) return;

    event.preventDefault();
    this.measure();
  }

  private measureAfterRender() {
    afterNextRender({ read: () => this.measure() }, { injector: this.injector });
  }
}
