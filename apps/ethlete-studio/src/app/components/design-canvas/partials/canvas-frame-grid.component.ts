import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { EMPTY, Observable, filter, fromEvent, map, switchMap, tap } from 'rxjs';
import { FrameCell, FrameGrid, FrameMessage, frameMessageOf } from '../canvas-frame';
import { Rect, Size } from '../canvas-math';

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

const cellKeyOf = (row: string, column: string) => JSON.stringify([row, column]);

@Component({
  selector: 'ethlete-canvas-frame-cell',
  template: `
    @if (!painted() && cell().screenshot; as screenshot) {
      <img [src]="screenshot" (load)="readScreenshotSize($event)" class="absolute left-0 top-0 max-w-none" alt="" />
    }
    @if (live()) {
      <iframe
        #iframe
        [src]="url()"
        [title]="cell().label"
        [class.opacity-0]="!painted()"
        class="absolute inset-0 size-full border-0 [color-scheme:normal] group-data-[dragging]/canvas:pointer-events-none"
      ></iframe>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'relative block',
    '[style.width.px]': 'cell().width ?? size()?.width ?? 0',
    '[style.height.px]': 'size()?.height ?? 0',
    '[attr.data-cell-id]': 'cell().id',
  },
})
export class CanvasFrameCellComponent {
  private sanitizer = inject(DomSanitizer);

  public cell = input.required<FrameCell>();
  public live = input(false);

  private iframe = viewChild<ElementRef<HTMLIFrameElement>>('iframe');

  protected url = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.cell().src));

  protected size = signal<Size | null>(null);

  protected painted = linkedSignal<string | null, boolean>({
    source: () => (this.live() ? this.cell().src : null),
    computation: () => false,
  });

  constructor() {
    toObservable(this.iframe)
      .pipe(
        switchMap((iframe) => (iframe ? this.reportedSizes$(iframe.nativeElement) : EMPTY)),
        tap((size) => {
          this.size.set(size);
          this.painted.set(true);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readScreenshotSize(event: Event) {
    const image = event.target as HTMLImageElement;

    this.size.set({ width: image.naturalWidth, height: image.naturalHeight });
  }

  private reportedSizes$(iframe: HTMLIFrameElement): Observable<Size> {
    const host = iframe.ownerDocument.defaultView;

    if (!host) return EMPTY;

    return fromEvent<MessageEvent>(host, 'message').pipe(
      filter((event) => !!iframe.contentWindow && event.source === iframe.contentWindow),
      map(({ data }) => frameMessageOf(data)),
      filter((message): message is HeightMessage => message?.type === 'height'),
      map((message) => ({ width: message.width ?? 0, height: message.height })),
    );
  }
}

/**
 * The cells of a frame's grid under a header row of interactions, each row led by its state. A `sheet` grid draws its
 * cells as one sheet on a sunken body: a `table` sheet every row in that table, each cell centred; a `groups` sheet the
 * rows that use more than the first column as that table, the others packed as many to a line as the grid has columns,
 * each under its state.
 */
@Component({
  selector: 'ethlete-canvas-frame-grid',
  template: `
    @if (sheet(); as sheet) {
      <div
        #table
        [style.grid-template-columns]="'minmax(12rem, max-content) repeat(' + grid().columns.length + ', max-content)'"
        class="absolute left-0 top-0 grid w-max gap-px bg-surface-sunken px-[2.4rem] pb-[2.4rem] pt-[1.6rem] text-[1.1rem]/[1.4rem] text-text-muted"
        data-grid-sheet
      >
        @if (sheet.interactive.length > 0) {
          <span
            class="col-span-full mb-[0.8rem] border-b border-surface-border pb-[0.4rem] text-[1rem] uppercase tracking-[0.04em]"
            data-grid-group
            >States by interaction</span
          >
          <span></span>
          @for (column of grid().columns; track column) {
            <span class="self-end pb-[0.4rem] font-code" data-grid-column>{{ column }}</span>
          }
          @for (row of sheet.interactive; track row) {
            <span class="self-center pr-[0.8rem] font-code" data-grid-row>{{ row }}</span>
            @for (column of grid().columns; track column) {
              <div
                [class.grid]="sheet.centered"
                [class.place-items-center]="sheet.centered"
                class="bg-surface px-space-1 py-space-2 ring-1 ring-surface-border"
                data-grid-cell
              >
                @if (cellOf(row, column); as cell) {
                  <ethlete-canvas-frame-cell #cell [cell]="cell" [live]="cellLive(cell.id)" />
                } @else if (drawnRows().has(row)) {
                  <span class="font-code text-text-muted italic" data-grid-empty>not drawn</span>
                }
              </div>
            }
          }
        }
        @if (sheet.packed.length > 0) {
          <span
            class="col-span-full mb-[0.8rem] mt-[2.4rem] border-b border-surface-border pb-[0.4rem] text-[1rem] uppercase tracking-[0.04em] first:mt-0"
            data-grid-group
            >Rest only</span
          >
          @for (line of sheet.packed; track $index; let firstLine = $first) {
            <span></span>
            @for (row of line; track row) {
              <span [class.pt-3]="!firstLine" class="self-end pb-[0.4rem] font-code" data-grid-row>{{ row }}</span>
            }
            @for (blank of blanksOf(line); track $index) {
              <span></span>
            }
            <span></span>
            @for (row of line; track row) {
              <div class="bg-surface px-space-1 py-space-2 ring-1 ring-surface-border" data-grid-cell>
                @if (cellOf(row, sheet.first); as cell) {
                  <ethlete-canvas-frame-cell #cell [cell]="cell" [live]="cellLive(cell.id)" />
                }
              </div>
            }
            @for (blank of blanksOf(line); track $index) {
              <span></span>
            }
          }
        }
      </div>
    } @else {
      <div
        #table
        [style.grid-template-columns]="'auto repeat(' + grid().columns.length + ', auto)'"
        class="absolute left-0 top-0 grid w-max items-center gap-x-[3.2rem] gap-y-[2.4rem] p-[2.4rem] text-[1.2rem] text-text-muted"
      >
        <span></span>
        @for (column of grid().columns; track column) {
          <span data-grid-column>{{ column }}</span>
        }
        @for (row of grid().rows; track row) {
          <span class="pr-[0.8rem]" data-grid-row>{{ row }}</span>
          @for (column of grid().columns; track column) {
            @if (cellOf(row, column); as cell) {
              <ethlete-canvas-frame-cell #cell [cell]="cell" [live]="cellLive(cell.id)" />
            } @else if (drawnRows().has(row)) {
              <span class="font-code text-text-muted italic" data-grid-empty>not drawn</span>
            } @else {
              <span></span>
            }
          }
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CanvasFrameCellComponent],
})
export class CanvasFrameGridComponent {
  public grid = input.required<FrameGrid>();
  public live = input(false);
  /** The cells that go live while `live`; `null` makes every cell live. */
  public liveCells = input<ReadonlySet<string> | null>(null);

  public sizeChange = output<Size>();
  /** Each cell's box in CSS pixels from the grid's top left corner, by cell id. */
  public cellsChange = output<Record<string, Rect>>();

  private table = viewChild<ElementRef<HTMLElement>>('table');
  private cells = viewChildren('cell', { read: ElementRef<HTMLElement> });

  private cellAt = computed(
    () => new Map<string, FrameCell>(this.grid().cells.map((cell) => [cellKeyOf(cell.row, cell.column), cell])),
  );

  protected drawnRows = computed(() => new Set(this.grid().cells.map((cell) => cell.row)));

  private observed = computed(() => {
    const table = this.table()?.nativeElement;

    return table ? [table, ...this.cells().map((cell) => cell.nativeElement)] : [];
  });

  protected sheet = computed(() => {
    const { columns, rows, sheet } = this.grid();

    if (!sheet) return null;

    const [first = ''] = columns;
    const restOnly = (row: string) =>
      sheet === 'groups' && columns.slice(1).every((column) => !this.cellOf(row, column));
    const rest = rows.filter(restOnly);
    const perLine = Math.max(columns.length, 1);

    return {
      first,
      centered: sheet === 'table',
      interactive: rows.filter((row) => !restOnly(row)),
      packed: Array.from({ length: Math.ceil(rest.length / perLine) }, (_, line) =>
        rest.slice(line * perLine, (line + 1) * perLine),
      ),
    };
  });

  constructor() {
    toObservable(this.observed)
      .pipe(
        switchMap((elements) => this.resized$(elements)),
        tap(() => this.report()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected cellLive(id: string) {
    const liveCells = this.liveCells();

    return this.live() && (liveCells === null || liveCells.has(id));
  }

  protected blanksOf(line: string[]) {
    return Array.from({ length: this.grid().columns.length - line.length });
  }

  protected cellOf(row: string, column: string) {
    return this.cellAt().get(cellKeyOf(row, column));
  }

  private report() {
    const table = this.table()?.nativeElement;

    if (!table) return;

    this.sizeChange.emit({ width: table.offsetWidth, height: table.offsetHeight });
    this.cellsChange.emit(
      Object.fromEntries(
        this.cells().map(({ nativeElement: cell }) => [
          cell.dataset['cellId'] ?? '',
          { x: cell.offsetLeft, y: cell.offsetTop, width: cell.offsetWidth, height: cell.offsetHeight },
        ]),
      ),
    );
  }

  private resized$(elements: HTMLElement[]) {
    const Observer = elements[0]?.ownerDocument.defaultView?.ResizeObserver;

    if (!Observer) return EMPTY;

    return new Observable<void>((subscriber) => {
      const observer = new Observer(() => subscriber.next());

      elements.forEach((element) => observer.observe(element));

      return () => observer.disconnect();
    });
  }
}
